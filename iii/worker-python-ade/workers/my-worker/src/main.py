"""my-worker: my-worker::hello, its settings, its own trigger type, an admin page
in the ADE, and the public page users open at http://127.0.0.1:3111/my-worker through the http worker."""

from __future__ import annotations

import asyncio
import os
import signal
import threading
from pathlib import Path
from typing import Any

from iii import InitOptions, TriggerAction, register_worker
from iii.triggers import TriggerConfig, TriggerHandler

NAME = "my-worker"
WEB_PATH = f"/{NAME}"
# Written by `pnpm build` in ui/: dist/ui is the ADE page, dist/web the public one.
DIST = Path(__file__).resolve().parent.parent / "dist"

DEFAULT_SETTINGS = {"greeting": "Hello"}
GREETING_MAX = 40
SETTINGS_SCHEMA = {
    "type": "object",
    "properties": {"greeting": {"type": "string", "description": "Word said before the name"}},
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


def web_url(base: str | None = None) -> str | None:
    """Where the public page answers: the http worker's base URL (III_HTTP_URL)
    plus this worker's route; None when it is unset or empty, so the ADE page
    falls back to the host it is browsed from."""
    return f"{base.rstrip('/')}{WEB_PATH}" if base else None


class HelloTriggers(TriggerHandler):
    """Provider of the `my-worker:hello` trigger type: fires after every my-worker::hello."""

    def __init__(self) -> None:
        self.bindings: dict[str, TriggerConfig] = {}

    async def register_trigger(self, config: TriggerConfig) -> None:
        self.bindings[config.id] = config

    async def unregister_trigger(self, config: TriggerConfig) -> None:
        self.bindings.pop(config.id, None)

    async def emit(self, iii: Any, event: dict[str, Any]) -> None:
        calls = []
        for binding in list(self.bindings.values()):
            config = binding.config if isinstance(binding.config, dict) else {}
            calls.append(
                iii.trigger_async(
                    {
                        "function_id": binding.function_id,
                        "namespace": binding.namespace,
                        "payload": event,
                        # The subscriber's metadata (its config's first) reaches the handler as its
                        # second argument; it is never merged into the payload.
                        "metadata": config.get("metadata", binding.metadata),
                        "action": TriggerAction.Void(),
                    }
                )
            )
        # Fire-and-forget: a subscriber that went away must not fail the call that emitted.
        await asyncio.gather(*calls, return_exceptions=True)


def load_settings(iii: Any) -> dict[str, Any]:
    """Seed the `my-worker` configuration once, then return its effective value."""

    def call(function_id: str, payload: dict[str, Any]) -> Any:
        # configuration::* runs in the engine's `default` namespace, whatever this worker's is.
        return iii.trigger({"function_id": function_id, "namespace": "default", "payload": payload})

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
    return {**DEFAULT_SETTINGS, **(call("configuration::get", {"id": NAME})["value"] or {})}


def register(iii: Any, dist: Path = DIST) -> None:
    """Register every function, trigger type and trigger of this worker."""
    settings = load_settings(iii)
    hello_triggers = HelloTriggers()

    async def hello(payload: dict[str, Any]) -> dict[str, str]:
        name = str(payload.get("name") or "").strip() or "World"
        result = build_greeting(settings["greeting"], name)
        await hello_triggers.emit(iii, {"name": name, **result})
        return result

    def info(_payload: dict[str, Any]) -> dict[str, str | None]:
        return {
            "web_url": web_url(os.environ.get("III_HTTP_URL")),
            "web_path": WEB_PATH,
            "greeting": settings["greeting"],
        }

    async def set_greeting(payload: dict[str, Any]) -> dict[str, str]:
        greeting = normalize_greeting(payload.get("greeting"))
        # configuration::* runs in the engine's `default` namespace; the configuration trigger
        # below reloads `settings` after the write too.
        await iii.trigger_async(
            {
                "function_id": "configuration::set",
                "namespace": "default",
                "payload": {"id": NAME, "value": {"greeting": greeting}},
            }
        )
        settings["greeting"] = greeting
        return {"greeting": greeting}

    def config_changed(event: dict[str, Any]) -> dict[str, bool]:
        settings.update(event.get("new_value") or {})
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
            result = await iii.trigger_async({"function_id": f"{NAME}::{fn}", "payload": payload})
        except Exception as error:  # the page shows the message, as the Node template does
            return {"status_code": 500, "headers": JSON_HEADERS, "body": {"error": str(error)}}
        return {"status_code": 200, "headers": JSON_HEADERS, "body": result}

    iii.register_function(
        f"{NAME}::hello",
        hello,
        description=f"Greet `name` with the configured greeting. Fires {NAME}:hello.",
        request_format=HELLO_REQUEST,
        response_format=HELLO_RESPONSE,
    )
    iii.register_trigger_type(
        {
            "id": f"{NAME}:hello",
            "description": (
                f"Fires after every {NAME}::hello with {{name, message}}. Config: {{metadata?}}. "
                "The metadata (the config's, else the binding's) reaches the handler as its second argument."
            ),
            "trigger_request_format": {"type": "object", "properties": {"metadata": {}}},
            "call_request_format": {
                "type": "object",
                "properties": {"name": {"type": "string"}, "message": {"type": "string"}},
                "required": ["name", "message"],
            },
        },
        hello_triggers,
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
    iii.register_trigger(
        {
            "type": "configuration",
            "function_id": f"{NAME}::config-changed",
            "config": {"configuration_id": NAME, "event_types": ["configuration:updated"]},
        }
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
    for trigger_type, path in (("console:script", f"{NAME}/page.js"), ("console:style", f"{NAME}/styles.css")):
        iii.register_trigger({"type": trigger_type, "function_id": f"{NAME}::ui-content", "config": {"path": path}})
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
        iii.register_trigger(
            {"type": "http", "function_id": function_id, "config": {"api_path": api_path, "http_method": method}}
        )


def main() -> None:
    iii = register_worker(
        options=InitOptions(
            worker_name=NAME, worker_description=f"{NAME}: hello, settings, a public page and an ADE admin page."
        )
    )
    register(iii)
    print(f"{NAME} started: http://127.0.0.1:3111/{NAME}", flush=True)
    # The SDK runs its event loop in a non-daemon thread, so the process outlives
    # main() and does not exit on SIGINT. Wait for SIGINT (watchfiles, on every save)
    # or SIGTERM (Compose, on stop), then disconnect and let the process end.
    stop = threading.Event()
    for sig in (signal.SIGINT, signal.SIGTERM):
        signal.signal(sig, lambda *_: stop.set())
    stop.wait()
    iii.shutdown()


if __name__ == "__main__":
    main()
