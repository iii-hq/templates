# my-worker

A Python worker project. `workers/my-worker` registers `my-worker::hello`, keeps its settings in the `my-worker` configuration, provides the `my-worker:hello` trigger type, and shows two pages: a console-native one inside the ADE, built from the console's own components, and a plainer standalone page at http://127.0.0.1:3111/my-worker through the `http` worker.

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
3. when `dist/ui/page.js` is missing, it runs `pnpm install && pnpm build` in `ui/`, which writes `dist/ui` (the ADE page) and `dist/web` (the page served over HTTP). Without pnpm it warns and goes on; the pages stay unavailable until `ui/` is built.

If the hook fails, the worker does not start; read the hook error before retrying. Compose also starts the `http` worker, which serves the page.

`run` is `sh scripts/start.sh` too: it repeats these steps (a no-op once done), then starts the worker under `watchfiles`. A compose entry without `pre_run`, such as a bare `compose::add worker=<dir>`, therefore starts as well: the worker bootstraps itself on its first start, only slower, and that bootstrap counts against Compose's `startup_timeout` (60s by default; this template's `worker-compose.yaml` sets 360s). Under `run`, a failing `pnpm install` or build only warns and the worker starts without the pages; `--prepare` fails instead.

## Call the worker

In terminal 2, also from the project root:

```sh
iii trigger my-worker::hello name=World
```

Expected response:

```json
{ "message": "Hello, World!" }
```

## Open the page

- **ADE:** uncomment the `ade` container in `worker-compose.yaml` and restart Compose, then open `http://127.0.0.1:3113` and pick the `my-worker` page. Alone, it is at `http://127.0.0.1:3113/#/worker/my-worker/my-worker`. The page uses the console's components and calls the worker through the console's own connection, not over HTTP. **Open outside console** opens the standalone page in a new tab. Its address is `my-worker::info`'s `web_url`: the worker's `III_HTTP_URL` environment variable (default `http://127.0.0.1:3111`) plus `/my-worker`. Set it when the `http` worker is reachable somewhere else.
- **Browser:** `http://127.0.0.1:3111/my-worker`. A plainer version of the same call, in plain React: it calls the worker through `POST /my-worker/api/hello`.

The ADE page is `ui/WorkerPage.tsx`; the standalone page is `ui/App.tsx`. How it works, how to edit it and how to run the tests: `workers/my-worker/README.md`.

## Security

The `http` worker on port 3111 has no authentication. Anyone who can reach the port can load the page and call every function in `API_FUNCTIONS` (`workers/my-worker/src/main.py`). Do not expose port 3111 through a public proxy or tunnel.
