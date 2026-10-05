# my-worker

A Python worker with two pages: the public page users open over HTTP, with its own design, and the worker's admin in the ADE, built from the console's components.

| What | Where |
|---|---|
| `my-worker::hello`: `{ name? }` → `{ message }` | `src/main.py` |
| `my-worker::info`: internal, `{}` → `{ web_url, web_path, greeting }` (`web_url` is `null` unless `III_HTTP_URL` is set), feeds the ADE page's **Open public page** button | `src/main.py` |
| `my-worker::set-greeting`: internal, `{ greeting }` → `{ greeting }` (trimmed, 1 to 40 characters), saves it in the `my-worker` configuration; the ADE page's Save calls it, it is not on the HTTP allowlist | `src/main.py` |
| The `my-worker` configuration (`greeting`), reloaded on `configuration:updated` | `src/main.py` |
| The `my-worker:hello` trigger type, fired after every `my-worker::hello` | `src/main.py` |
| ADE assets: `my-worker::ui-content` with `console:script` / `console:style` | `src/main.py`, `ui/page.tsx` |
| `GET /my-worker`, `GET /my-worker/:file`, `POST /my-worker/api/:fn` | `src/main.py`, `web/` |
| The ADE page, the worker's admin (Settings, Test, Endpoints), from the console's components | `ui/WorkerPage.tsx` |
| The public page, plain React with its own design | `web/App.tsx`, `web/app.css` |

## Prerequisites

Python 3.11 or newer, Node 22 or newer and pnpm 10 or newer. `scripts/start.sh` creates `.venv`, installs the worker, builds the pages when any `dist/` output is missing and starts the worker under `scripts/dev.py`, which restarts it on save and exits when it crashes. Compose's `scripts.pre_run` runs it with `--prepare` before the start; a bare `compose::add worker=<dir>` has no `pre_run`, so the worker bootstraps itself on its first start, only slower, and that bootstrap counts against Compose's `startup_timeout` (60s by default; this template's `worker-compose.yaml` sets 360s). Without pnpm the worker still starts, and the pages stay unavailable until `ui/` is built.

## How the pages work

Two screens call the same worker:

- In the ADE, `ui/page.tsx` registers `ui/WorkerPage.tsx`, the worker's admin. It uses the `@iii-dev/console-ui` components the console supplies at runtime, and calls `my-worker::hello`, `my-worker::info` and `my-worker::set-greeting` through `host.iii`. Settings edits the greeting, Test says hello and Endpoints lists where the worker answers. Its **Open public page** button links to `http://<console host>:3111/my-worker`, or to the `web_url` that `my-worker::info` returns when `III_HTTP_URL` is set (`III_HTTP_URL` plus `/my-worker`). While the `http` worker listens on `127.0.0.1`, that answers only from this machine. To open it from another device, use an SSH tunnel (`ssh -L 3111:127.0.0.1:3111 <host>`) or set `III_HTTP_URL` to an address that reaches it, and never expose port 3111 on an untrusted network.
- In a browser, `web/main.tsx` renders `web/App.tsx`, the public page: plain React with its own design and no console components or lint, and passes it `httpClient('/my-worker/api')` (`web/client.ts`), which POSTs the payload as JSON to `/my-worker/api/<fn>`.

`pnpm build` in `ui/` builds both: `dist/ui` for the ADE and `dist/web` for the public page. The worker reads them from `dist/` on each request.

- `/my-worker/:file` serves only `app.js` and `styles.css`.
- `/my-worker/api/:fn` calls only the functions named in `API_FUNCTIONS`. To expose another function to the public page, add its short name to that set.

## Edit

- `src/main.py`: `scripts/dev.py` restarts the worker on save. A crash ends it, and Compose's `restart: on-failure` retries.
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
