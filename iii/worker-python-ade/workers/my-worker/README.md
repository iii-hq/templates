# my-worker

A Python worker with one page: built from the console's components in the ADE, and a plainer version of the same call over HTTP.

| What | Where |
|---|---|
| `my-worker::hello`: `{ name? }` → `{ message }` | `src/main.py` |
| `my-worker::info`: internal, `{}` → `{ web_url, greeting }`, feeds the ADE page's **Open outside console** button | `src/main.py` |
| The `my-worker` configuration (`greeting`), reloaded on `configuration:updated` | `src/main.py` |
| The `my-worker:hello` trigger type, fired after every `my-worker::hello` | `src/main.py` |
| ADE assets: `my-worker::ui-content` with `console:script` / `console:style` | `src/main.py`, `ui/page.tsx` |
| `GET /my-worker`, `GET /my-worker/:file`, `POST /my-worker/api/:fn` | `src/main.py`, `web/` |
| The ADE page, from the console's components | `ui/WorkerPage.tsx` |
| The standalone page, plain React | `ui/App.tsx` |

## Prerequisites

Python 3.11 or newer, Node 22 or newer and pnpm 10 or newer. `scripts/start.sh` creates `.venv`, installs the worker, builds the page when `dist/ui/page.js` is missing and starts the worker under `watchfiles`. Compose's `scripts.pre_run` runs it with `--prepare` before the start; a bare `compose::add worker=<dir>` has no `pre_run`, so the worker bootstraps itself on its first start, only slower. Without pnpm the worker still starts, and the pages stay unavailable until `ui/` is built.

## How the page works

Two screens make the same call:

- In the ADE, `ui/page.tsx` registers `ui/WorkerPage.tsx`. It uses the `@iii-dev/console-ui` components the console supplies at runtime, and calls `my-worker::hello` and `my-worker::info` through `host.iii`. Its **Open outside console** button links to the `web_url` that `my-worker::info` returns: `III_HTTP_URL` (default `http://127.0.0.1:3111`) plus `/my-worker`. Set `III_HTTP_URL` in the worker's environment when the `http` worker is reachable somewhere else.
- In a browser, `web/main.tsx` renders `ui/App.tsx`, plain React with no console components, and passes it `httpClient('/my-worker/api')`, which POSTs the payload as JSON to `/my-worker/api/<fn>`.

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
