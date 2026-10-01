"""The three HTTP routes: the page, its allowlisted files, the allowlisted API."""

import asyncio

import pytest

from src.main import NAME, register

PAGE = ("GET", f"/{NAME}")
FILE = ("GET", f"/{NAME}/:file")
API = ("POST", f"/{NAME}/api/:fn")


@pytest.fixture
def routes(bus, dist):
    register(bus, dist)
    return {
        (t["config"]["http_method"], t["config"]["api_path"]): bus.functions[t["function_id"]]
        for t in bus.triggers
        if t["type"] == "http"
    }


def test_three_routes(routes):
    assert set(routes) == {PAGE, FILE, API}


def test_page_is_index_html(routes, dist):
    assert routes[PAGE]({"path_params": {}}) == {
        "status_code": 200,
        "headers": {"content-type": "text/html; charset=utf-8"},
        "body": (dist / "web" / "index.html").read_text(),
    }


@pytest.mark.parametrize(
    ("file", "content_type"),
    [("app.js", "text/javascript; charset=utf-8"), ("styles.css", "text/css; charset=utf-8")],
)
def test_allowlisted_files(routes, dist, file, content_type):
    assert routes[FILE]({"path_params": {"file": file}}) == {
        "status_code": 200,
        "headers": {"content-type": content_type},
        "body": (dist / "web" / file).read_text(),
    }


@pytest.mark.parametrize("file", ["..", "../../pyproject.toml", "../ui/page.js", "index.html", ""])
def test_other_files_are_not_found(routes, file):
    assert routes[FILE]({"path_params": {"file": file}})["status_code"] == 404


def test_api_calls_the_function_with_the_body(routes, bus):
    response = asyncio.run(routes[API]({"path_params": {"fn": "hello"}, "body": {"name": "Ada"}}))
    assert response == {
        "status_code": 200,
        "headers": {"content-type": "application/json"},
        "body": {"message": "Hello, Ada!"},
    }
    assert [call["payload"] for call in bus.called(f"{NAME}::hello")] == [{"name": "Ada"}]


def test_api_ignores_a_body_that_is_not_an_object(routes):
    response = asyncio.run(routes[API]({"path_params": {"fn": "hello"}, "body": "Ada"}))
    assert response["body"] == {"message": "Hello, World!"}


def test_api_turns_a_failed_call_into_a_500(routes, bus):
    def boom(_payload):
        raise RuntimeError("boom")

    bus.functions[f"{NAME}::hello"] = boom
    response = asyncio.run(routes[API]({"path_params": {"fn": "hello"}, "body": {}}))
    assert response == {"status_code": 500, "headers": {"content-type": "application/json"}, "body": {"error": "boom"}}


@pytest.mark.parametrize("fn", ["ui-content", "config-changed", "../hello", ""])
def test_api_rejects_functions_outside_the_allowlist(routes, bus, fn):
    response = asyncio.run(routes[API]({"path_params": {"fn": fn}, "body": {}}))
    assert response["status_code"] == 404
    assert not [call for call in bus.calls if call["function_id"].startswith(f"{NAME}::")]
