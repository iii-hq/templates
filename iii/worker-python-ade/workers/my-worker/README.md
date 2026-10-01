# my-worker

A Python worker with one page, shown inside the ADE and over HTTP.

| What | Where |
|---|---|
| `my-worker::hello`: `{ name? }` → `{ message }` | `src/main.py` |
| The `my-worker` configuration (`greeting`), reloaded on `configuration:updated` | `src/main.py` |
| The `my-worker:hello` trigger type, fired after every `my-worker::hello` | `src/main.py` |
| ADE assets: `my-worker::ui-content` with `console:script` / `console:style` | `src/main.py`, `ui/page.tsx` |
| `GET /my-worker`, `GET /my-worker/:file`, `POST /my-worker/api/:fn` | `src/main.py`, `web/` |
| The screen, shared by both | `ui/App.tsx` |

## Prerequisites

Python 3.11 or newer, Node 22 or newer and pnpm 10 or newer. Compose's `scripts.pre_run` creates `.venv`, installs the worker and builds the page.

## How the page works

`ui/App.tsx` takes a `client` with one method, `call(fn, payload)`:

- In the ADE, `ui/page.tsx` passes `hostClient(host)`, which calls `my-worker::<fn>` through `host.iii`.
- In a browser, `web/main.tsx` passes `httpClient('/my-worker/api')`, which POSTs the payload as JSON to `/my-worker/api/<fn>`.

`pnpm build` in `ui/` builds both: `dist/ui` for the ADE and `dist/web` for the browser. The worker reads them from `dist/` on each request.

- `/my-worker/:file` serves only `app.js` and `styles.css`.
- `/my-worker/api/:fn` calls only the functions named in `API_FUNCTIONS`. To expose another function to the browser page, add its short name to that set.

## Edit

- `src/main.py`: `watchfiles` restarts the worker on save.
- `ui/` or `web/`: run `pnpm build` in `ui/`. The new `dist/` restarts the worker, which registers the page again.

## Tests

From this directory, after the first Compose start:

```sh
.venv/bin/python -m pip install -e '.[dev]'
.venv/bin/python -m pytest
.venv/bin/ruff check src tests
```

The tests run against a small fake bus (`tests/conftest.py`), so they need no engine.

## Security

The `http` worker on port 3111 has no authentication. Anyone who can reach the port can load the page and call every function in `API_FUNCTIONS`. Do not expose port 3111 through a public proxy or tunnel.
