"""hello-python worker — exposes hello-python::greet over iii."""

GREET_REQUEST = {
    "type": "object",
    "properties": {"name": {"type": "string", "description": "Who to greet"}},
    "required": ["name"],
}
GREET_RESPONSE = {
    "type": "object",
    "properties": {"message": {"type": "string"}},
    "required": ["message"],
}


def build_greeting(name: str) -> dict:
    """Return a greeting dict for the given name.

    Pure function — no SDK dependency — importable in tests without the engine.
    """
    return {"message": f"Hello, {name}!"}


def main() -> None:
    """Connect to the engine, register functions, and listen."""
    import os
    # SDK import lives inside main() so build_greeting is importable standalone
    # (e.g. in unit tests) without iii-sdk being installed.
    from iii import register_worker, InitOptions

    worker = register_worker(
        os.environ.get("III_URL", "ws://localhost:49134"),
        InitOptions(worker_name="hello-python"),
    )

    def greet_handler(payload: dict) -> dict:
        name = payload.get("name", "World")
        return build_greeting(name)

    worker.register_function(
        "hello-python::greet",
        greet_handler,
        description="Return a greeting for `name`.",
        request_format=GREET_REQUEST,
        response_format=GREET_RESPONSE,
    )

    print("hello-python started - listening for calls")


if __name__ == "__main__":
    main()
