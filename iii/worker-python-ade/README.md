# my-worker

A Python worker project. `workers/my-worker` registers `my-worker::hello`, keeps its settings in the `my-worker` configuration, provides the `my-worker:hello` trigger type, and has two pages: the public page users open at http://127.0.0.1:3111/my-worker through the `http` worker, and the worker's admin inside the ADE, built from the console's own components.

## Prerequisites

- iii 0.24.2 or newer
- Python 3.11 or newer, including the standard-library `venv` module
- Node 22 or newer and pnpm 10 or newer, to build the page

## Start

In terminal 1, from the project root:

```sh
iii compose --up
```

Before starting `my-worker`, Compose runs its `scripts.pre_run` from `workers/my-worker`: `sh scripts/start.sh --prepare`.

1. It creates the private `.venv` when it is missing;
2. it installs the worker into it with `pip install -e .` when `pyproject.toml` changed since the last install;
3. when any page output in `dist/` is missing, it runs `pnpm install && pnpm build` in `ui/`, which writes `dist/ui` (the ADE page) and `dist/web` (the page served over HTTP). Without pnpm it warns and goes on; the pages stay unavailable until `ui/` is built.

If the hook fails, the worker does not start; read the hook error before retrying. Compose also starts the `http` worker, which serves the page.

`run` is `sh scripts/start.sh` too: it repeats these steps (a no-op once done), then starts the worker under `scripts/dev.py`, which restarts it on save and ends when it crashes, so `restart: on-failure` retries it. A compose entry without `pre_run`, such as a bare `compose::add worker=<dir>`, therefore starts as well: the worker bootstraps itself on its first start, only slower, and that bootstrap counts against Compose's `startup_timeout` (60s by default; this template's `worker-compose.yaml` sets 360s). Under `run`, a failing `pnpm install` or build only warns and the worker starts without the pages; `--prepare` fails instead.

## Call the worker

In terminal 2, also from the project root:

```sh
iii trigger my-worker::hello name=World
```

Expected response:

```json
{ "message": "Hello, World!" }
```

## Open the pages

- **Public page:** `http://127.0.0.1:3111/my-worker`. What a user opens, with its own design in plain React: the worker's name on top and a card that asks for a name and shows the greeting large. It calls the worker through `POST /my-worker/api/hello`.
- **Admin, in the ADE:** uncomment the `ade` container in `worker-compose.yaml` and restart Compose, then open `http://127.0.0.1:3113` and pick the `my-worker` page. Alone, it is at `http://127.0.0.1:3113/#/worker/my-worker/my-worker`. The page is the worker's admin: it edits the greeting (Settings), tries `my-worker::hello` (Test) and lists the endpoints. It uses the console's components and calls the worker through the console's own connection, not over HTTP. **Open public page** opens the public page in a new tab at `http://<console host>:<port>/my-worker`, with the port `http::status` reports (3111 by default), or at the worker's `III_HTTP_URL` plus `/my-worker` when that environment variable is set (`my-worker::info` returns it as `web_url`). While the `http` worker listens on `127.0.0.1`, that answers only from this machine. To open it from another device, use an SSH tunnel (`ssh -L <port>:127.0.0.1:<port> <host>`) or set `III_HTTP_URL` to an address that reaches it, and never expose that port on an untrusted network.

The public page is `web/App.tsx`; the ADE page is `ui/WorkerPage.tsx`. How it works, how to edit it and how to run the tests: `workers/my-worker/README.md`.

## Security

The `http` worker on port 3111 has no authentication. Anyone who can reach the port can load the page and call every function in `API_FUNCTIONS` (`workers/my-worker/src/main.py`: `hello`, not `my-worker::set-greeting`, so only the ADE changes the greeting). Do not expose port 3111 through a public proxy or tunnel.
