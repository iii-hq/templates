"""my-worker: my-worker::hello, its settings, its own event function, an admin page
in the ADE, and the public page users open at /my-worker on the http worker (http::status reports its address)."""

from __future__ import annotations

import os
import signal
import threading
from pathlib import Path
from typing import Any

from iii import CallAction, InitOptions, register_worker

NAME = "my-worker"
WEB_PATH = f"/{NAME}"
# Written by `pnpm build` in ui/: dist/ui is the ADE page, dist/web the public one.
DIST = Path(__file__).resolve().parent.parent / "dist"

DEFAULT_SETTINGS = {"greeting": "Hello"}
GREETING_MAX = 40
SETTINGS_SCHEMA = {
    "type": "object",
    "properties": {"greeting": {"type": "string", "minLength": 1, "description": "Word said before the name"}},
    "required": ["greeting"],
}
HELLO_REQUEST = {
    "type": "object",
    "properties": {"name": {"type": "string", "description": "Who to greet; World when empty"}},
}
HELLO_RESPONSE = {
    "type": "object",
    "properties": {"message": {"type": "string"}},
    "required": ["message"],
}
INFO_RESPONSE = {
    "type": "object",
    "properties": {
        "web_url": {"type": ["string", "null"]},
        "web_path": {"type": "string"},
        "greeting": {"type": "string"},
    },
    "required": ["web_path", "greeting"],
}
SET_GREETING_REQUEST = {
    "type": "object",
    "properties": {"greeting": {"type": "string", "minLength": 1, "maxLength": GREETING_MAX}},
    "required": ["greeting"],
}
SET_GREETING_RESPONSE = {
    "type": "object",
    "properties": {"greeting": {"type": "string"}},
    "required": ["greeting"],
}
ANY_OBJECT = {"type": "object"}

# The HTTP routes take `:file` and `:fn` straight from the URL (`..` included),
# so they serve only these files and call only these functions.
WEB_FILES = {"app.js": "text/javascript; charset=utf-8", "styles.css": "text/css; charset=utf-8"}
API_FUNCTIONS = {"hello"}
JSON_HEADERS = {"content-type": "application/json"}
NOT_FOUND = {"status_code": 404, "headers": JSON_HEADERS, "body": {"error": "not found"}}


def build_greeting(greeting: str, name: str) -> dict[str, str]:
    """Pure domain logic, testable without an engine."""
    return {"message": f"{greeting}, {name}!"}


def normalize_greeting(value: Any) -> str:
    """A greeting the admin page may save: trimmed, non-empty, at most 40 characters."""
    greeting = ("" if value is None else str(value)).strip()
    if not greeting:
        raise ValueError("greeting must not be empty")
    if len(greeting) > GREETING_MAX:
        raise ValueError(f"greeting must be at most {GREETING_MAX} characters")
    return greeting


def stored_greeting(value: Any) -> str:
    """The greeting in a stored configuration value; the default when it is missing or invalid."""
    try:
        return normalize_greeting(value.get("greeting") if isinstance(value, dict) else None)
    except ValueError:
        return DEFAULT_SETTINGS["greeting"]


def web_url(base: str | None = None) -> str | None:
    """Where the public page answers: the http worker's base URL (III_HTTP_URL)
    plus this worker's route; None when it is unset or empty, so the ADE page
    falls back to the host it is browsed from."""
    return f"{base.rstrip('/')}{WEB_PATH}" if base else None


def load_settings(iii: Any) -> dict[str, Any]:
    """Seed the `my-worker` configuration once, then return its effective value."""

    def call(function_id: str, payload: dict[str, Any]) -> Any:
        # configuration::* runs in the engine's `default` namespace, whatever this worker's is.
        return iii.call({"function_id": function_id, "namespace": "default", "payload": payload})

    # ensure seeds initial_value only while no value is stored: a restart keeps every edit.
    call(
        "configuration::ensure",
        {
            "id": NAME,
            "name": NAME,
            "description": f"Greeting used by {NAME}::hello.",
            "schema": SETTINGS_SCHEMA,
            "initial_value": DEFAULT_SETTINGS,
        },
    )
    return {"greeting": stored_greeting(call("configuration::get", {"id": NAME})["value"])}


def register(iii: Any, dist: Path = DIST) -> None:
    """Register every function and observer of this worker."""
    settings = load_settings(iii)
    on_hello: Any = None  # the FunctionRef of NAME::on-hello, set below

    async def emit_hello(event: dict[str, Any]) -> None:
        # Only when someone observes it; fire-and-forget, so a slow observer never delays hello.
        if on_hello is None or not on_hello.is_observed():
            return
        try:
            await iii.call_async({"function_id": f"{NAME}::on-hello", "payload": event, "action": CallAction.Void()})
        except Exception as error:  # an emit failure must not fail the greeting
            print(f"[{NAME}] emit failed: {error}", flush=True)

    async def hello(payload: dict[str, Any]) -> dict[str, str]:
        name = str(payload.get("name") or "").strip() or "World"
        result = build_greeting(settings["greeting"], name)
        await emit_hello({"name": name, **result})
        return result

    def info(_payload: dict[str, Any]) -> dict[str, str | None]:
        return {
            "web_url": web_url(os.environ.get("III_HTTP_URL")),
            "web_path": WEB_PATH,
            "greeting": settings["greeting"],
        }

    async def set_greeting(payload: dict[str, Any]) -> dict[str, str]:
        greeting = normalize_greeting(payload.get("greeting"))
        # configuration::* runs in the engine's `default` namespace; the configuration::on-updated
        # observer below reloads `settings` after the write too.
        await iii.call_async(
            {
                "function_id": "configuration::set",
                "namespace": "default",
                "payload": {"id": NAME, "value": {"greeting": greeting}},
            }
        )
        settings["greeting"] = greeting
        return {"greeting": greeting}

    def config_changed(event: dict[str, Any]) -> dict[str, bool]:
        settings["greeting"] = stored_greeting(event.get("new_value"))
        return {"ok": True}

    ui_assets = {
        f"{NAME}/page.js": ("page.js", "text/javascript"),
        f"{NAME}/styles.css": ("styles.css", "text/css"),
    }

    def ui_content(payload: dict[str, Any]) -> dict[str, str]:
        asset = ui_assets.get(payload.get("path"))
        if asset is None:
            raise ValueError(f"Unknown UI asset: {payload.get('path')}")
        try:
            return {"content": (dist / "ui" / asset[0]).read_text(), "content_type": asset[1]}
        except FileNotFoundError:
            raise FileNotFoundError(
                f"dist/ui/{asset[0]} is missing: run pnpm build in ui/, then restart the worker"
            ) from None

    def text(path: Path, content_type: str) -> dict[str, Any]:
        return {"status_code": 200, "headers": {"content-type": content_type}, "body": path.read_text()}

    def page(_request: dict[str, Any]) -> dict[str, Any]:
        return text(dist / "web" / "index.html", "text/html; charset=utf-8")

    def web_file(request: dict[str, Any]) -> dict[str, Any]:
        name = request.get("path_params", {}).get("file")
        if name not in WEB_FILES:
            return NOT_FOUND
        return text(dist / "web" / name, WEB_FILES[name])

    async def api(request: dict[str, Any]) -> dict[str, Any]:
        fn = request.get("path_params", {}).get("fn")
        if fn not in API_FUNCTIONS:
            return NOT_FOUND
        body = request.get("body")
        payload = body if isinstance(body, dict) else {}
        try:
            result = await iii.call_async({"function_id": f"{NAME}::{fn}", "payload": payload})
        except Exception as error:  # the page shows the message, as the Node template does
            return {"status_code": 500, "headers": JSON_HEADERS, "body": {"error": str(error)}}
        return {"status_code": 200, "headers": JSON_HEADERS, "body": result}

    iii.register_function(
        f"{NAME}::hello",
        hello,
        description=f"Greet `name` with the configured greeting. Calls {NAME}::on-hello.",
        request_format=HELLO_REQUEST,
        response_format=HELLO_RESPONSE,
    )
    # A private function that returns the event it is called with: only this worker calls it,
    # anyone may observe it, and an observer's metadata reaches its target without this worker
    # forwarding anything.
    hello_event = {
        "type": "object",
        "properties": {"name": {"type": "string"}, "message": {"type": "string"}},
        "required": ["name", "message"],
    }

    def on_hello_event(event: dict[str, Any]) -> dict[str, Any]:
        return event

    on_hello = iii.register_function(
        f"{NAME}::on-hello",
        on_hello_event,
        description=f"Called after every {NAME}::hello with {{name, message}}. No args; filter on input.name.",
        request_format=hello_event,
        response_format=hello_event,
        private=True,
    )
    iii.register_function(
        f"{NAME}::info",
        info,
        description="Where the public page answers (web_url only when III_HTTP_URL is set), and the greeting.",
        metadata={"internal": True},
        request_format=ANY_OBJECT,
        response_format=INFO_RESPONSE,
    )
    iii.register_function(
        f"{NAME}::set-greeting",
        set_greeting,
        description="Save the greeting the public page uses (the ADE admin page calls this).",
        metadata={"internal": True},
        request_format=SET_GREETING_REQUEST,
        response_format=SET_GREETING_RESPONSE,
    )
    iii.register_function(
        f"{NAME}::config-changed",
        config_changed,
        description=f"Reload the {NAME} settings after configuration:updated.",
        metadata={"internal": True},
        request_format=ANY_OBJECT,
        response_format=ANY_OBJECT,
    )
    # configuration::on-updated takes no args: choose the entry and the event with filters, and
    # deliver the event itself (not the Observed envelope) to config_changed.
    iii.observe(
        {
            "function_id": "configuration::on-updated",
            "filters": {"input.id": {"$eq": NAME}, "input.event_type": {"$eq": "configuration:updated"}},
            "deliver": "input",
        },
        f"{NAME}::config-changed",
    )
    iii.register_function(
        f"{NAME}::ui-content",
        ui_content,
        description=f"Serve the {NAME} page assets to the ADE.",
        metadata={"internal": True},
        request_format={"type": "object", "properties": {"path": {"type": "string"}}, "required": ["path"]},
        response_format={
            "type": "object",
            "properties": {"content": {"type": "string"}, "content_type": {"type": "string"}},
            "required": ["content", "content_type"],
        },
    )
    for kind, path in (("script", f"{NAME}/page.js"), ("style", f"{NAME}/styles.css")):
        iii.observe({"function_id": "console::ui::asset", "args": {"kind": kind, "path": path}}, f"{NAME}::ui-content")
    for function_id, handler, api_path, method in (
        (f"{NAME}::http-page", page, f"/{NAME}", "GET"),
        (f"{NAME}::http-asset", web_file, f"/{NAME}/:file", "GET"),
        (f"{NAME}::http-api", api, f"/{NAME}/api/:fn", "POST"),
    ):
        iii.register_function(
            function_id,
            handler,
            description=f"HTTP {method} {api_path}",
            metadata={"internal": True},
            request_format=ANY_OBJECT,
            response_format=ANY_OBJECT,
        )
        iii.observe({"function_id": "http::on-request", "args": {"method": method, "path": api_path}}, function_id)


def main() -> None:
    iii = register_worker(
        options=InitOptions(
            worker_name=NAME, worker_description=f"{NAME}: hello, settings, a public page and an ADE admin page."
        )
    )
    try:
        register(iii)
    except BaseException:
        # The SDK's non-daemon thread would keep the process alive with no
        # functions; shut it down so the error ends the process and the dev
        # loop and Compose see the crash.
        iii.shutdown()
        raise
    print(f"{NAME} started: public page at {WEB_PATH} on the http worker", flush=True)
    # The SDK runs its event loop in a non-daemon thread, so the process outlives
    # main() and does not exit on SIGINT. Wait for SIGTERM (scripts/dev.py on every
    # save, Compose on stop) or SIGINT (Ctrl-C), then disconnect and let the process end.
    stop = threading.Event()
    for sig in (signal.SIGINT, signal.SIGTERM):
        signal.signal(sig, lambda *_: stop.set())
    stop.wait()
    iii.shutdown()


if __name__ == "__main__":
    main()
