"""my-worker::hello, its settings, its trigger type and its ADE assets, on the fake bus."""

import asyncio
import os
import signal
import threading

import pytest
from iii.triggers import TriggerConfig

import src.main
from src.main import NAME, SETTINGS_SCHEMA, build_greeting, register


def hello(bus, payload):
    return asyncio.run(bus.functions[f"{NAME}::hello"](payload))


def subscribe(bus, binding_id, function_id, config, metadata=None):
    binding = TriggerConfig(id=binding_id, function_id=function_id, config=config, metadata=metadata)
    asyncio.run(bus.trigger_types[f"{NAME}:hello"].register_trigger(binding))
    return binding


def fired(bus):
    return {call["function_id"]: call for call in bus.calls if call["function_id"].startswith("sub::")}


def test_build_greeting():
    assert build_greeting("Hello", "World") == {"message": "Hello, World!"}


def test_settings_are_ensured_then_read(bus, dist):
    bus.settings = {"greeting": "Hi"}
    register(bus, dist)
    assert [call["function_id"] for call in bus.calls] == ["configuration::ensure", "configuration::get"]
    assert {call["namespace"] for call in bus.calls} == {"default"}
    assert bus.calls[0]["payload"] == {
        "id": NAME,
        "name": NAME,
        "description": f"Greeting used by {NAME}::hello.",
        "schema": SETTINGS_SCHEMA,
        "initial_value": {"greeting": "Hello"},
    }
    assert hello(bus, {"name": "Ada"}) == {"message": "Hi, Ada!"}


def test_settings_update_changes_the_greeting(bus, dist):
    register(bus, dist)
    (binding,) = [trigger for trigger in bus.triggers if trigger["type"] == "configuration"]
    assert binding["config"] == {"configuration_id": NAME, "event_types": ["configuration:updated"]}
    bus.functions[binding["function_id"]]({"new_value": {"greeting": "Hey"}})
    assert hello(bus, {}) == {"message": "Hey, World!"}


def test_hello_fires_the_trigger_type_with_the_subscriber_metadata(bus, dist):
    register(bus, dist)
    first = subscribe(bus, "t1", "sub::first", {"metadata": {"from": "config"}}, {"from": "binding"})
    subscribe(bus, "t2", "sub::second", {}, {"from": "binding"})

    hello(bus, {"name": "Ada"})
    assert fired(bus)["sub::first"]["payload"] == {"name": "Ada", "message": "Hello, Ada!"}
    assert fired(bus)["sub::first"]["metadata"] == {"from": "config"}
    assert fired(bus)["sub::second"]["metadata"] == {"from": "binding"}

    asyncio.run(bus.trigger_types[f"{NAME}:hello"].unregister_trigger(first))
    bus.calls.clear()
    hello(bus, {"name": "Ada"})
    assert list(fired(bus)) == ["sub::second"]


def test_ui_content_serves_both_assets_and_rejects_others(bus, dist):
    register(bus, dist)
    content = bus.functions[f"{NAME}::ui-content"]
    assert content({"path": f"{NAME}/page.js"}) == {
        "content": (dist / "ui" / "page.js").read_text(),
        "content_type": "text/javascript",
    }
    assert content({"path": f"{NAME}/styles.css"})["content_type"] == "text/css"
    with pytest.raises(ValueError, match="Unknown UI asset"):
        content({"path": f"{NAME}/../../pyproject.toml"})
    assets = {(t["type"], t["config"]["path"]) for t in bus.triggers if t["type"].startswith("console:")}
    assert assets == {("console:script", f"{NAME}/page.js"), ("console:style", f"{NAME}/styles.css")}


def test_every_function_but_hello_is_internal(bus, dist):
    register(bus, dist)
    public = [fid for fid, options in bus.options.items() if not (options.get("metadata") or {}).get("internal")]
    assert public == [f"{NAME}::hello"]


def test_main_disconnects_on_sigterm(monkeypatch):
    shutdowns = []

    class Worker:
        def shutdown(self):
            shutdowns.append(True)

    monkeypatch.setattr(src.main, "register_worker", lambda **_: Worker())
    monkeypatch.setattr(src.main, "register", lambda iii: None)
    handlers = {sig: signal.getsignal(sig) for sig in (signal.SIGINT, signal.SIGTERM)}
    timer = threading.Timer(0.1, os.kill, (os.getpid(), signal.SIGTERM))
    timer.start()
    try:
        src.main.main()
    finally:
        timer.cancel()  # main() returned without waiting: fail the assert, not the run
        for sig, handler in handlers.items():
            signal.signal(sig, handler)
    assert shutdowns == [True]
