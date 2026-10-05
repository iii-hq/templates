"""A tiny in-memory bus standing in for the engine, and a built dist/ tree."""

from __future__ import annotations

import inspect
from pathlib import Path
from typing import Any

import pytest


class FakeBus:
    """Records registrations and calls; runs this worker's own functions in-process."""

    def __init__(self) -> None:
        self.functions: dict[str, Any] = {}
        self.options: dict[str, dict[str, Any]] = {}
        self.trigger_types: dict[str, Any] = {}
        self.triggers: list[dict[str, Any]] = []
        self.calls: list[dict[str, Any]] = []
        self.settings: dict[str, Any] | None = None  # the stored configuration value; None = nothing stored

    def register_function(self, function_id: str, handler: Any, **options: Any) -> None:
        self.functions[function_id] = handler
        self.options[function_id] = options

    def register_trigger_type(self, trigger_type: dict[str, Any], handler: Any) -> None:
        self.trigger_types[trigger_type["id"]] = handler

    def register_trigger(self, trigger: dict[str, Any]) -> None:
        self.triggers.append(trigger)

    def trigger(self, request: dict[str, Any]) -> Any:
        """The configuration worker: ensure seeds initial_value only while nothing is stored."""
        self.calls.append(request)
        payload = request["payload"]
        if request["function_id"] == "configuration::ensure" and self.settings is None:
            self.settings = payload["initial_value"]
        if request["function_id"] == "configuration::get":
            return {"id": payload["id"], "value": self.settings}
        return None

    async def trigger_async(self, request: dict[str, Any]) -> Any:
        self.calls.append(request)
        handler = self.functions.get(request["function_id"])
        if handler is None:
            return None
        result = handler(request["payload"])
        return await result if inspect.isawaitable(result) else result

    def called(self, function_id: str) -> list[dict[str, Any]]:
        return [call for call in self.calls if call["function_id"] == function_id]


@pytest.fixture
def bus() -> FakeBus:
    return FakeBus()


@pytest.fixture
def dist(tmp_path: Path) -> Path:
    """What `pnpm build` in ui/ writes."""
    for relative, text in {
        "ui/page.js": "export default function setup() {}",
        "ui/styles.css": ".page {}",
        "web/index.html": "<!doctype html><div id=root></div>",
        "web/app.js": "console.log('app')",
        "web/styles.css": ":root {}",
    }.items():
        path = tmp_path / "dist" / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text)
    return tmp_path / "dist"
