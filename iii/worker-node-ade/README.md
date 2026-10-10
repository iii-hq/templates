# my-worker

A Node/TypeScript worker project with one function, `my-worker::hello`, and two pages for it: the public page users open at `http://127.0.0.1:3111/my-worker` (`workers/my-worker/web/App.tsx`), served by the `http` worker, and the worker's admin in the ADE, built from the console's own components (`workers/my-worker/ui/WorkerPage.tsx`).

## Prerequisites

- iii 0.24.2 or newer
- Node.js 22 or newer
- pnpm 10 or newer (`corepack enable pnpm` installs it)

## Start and call

In terminal 1, from the project root, start Compose in the foreground:

```sh
iii compose --up
```

Compose runs `pnpm install` (`pre_run`) in `workers/my-worker`, then `node scripts/dev.mjs`, the dev loop `pnpm dev` runs. It builds the page, rebuilds it on every save, and restarts the worker when `src/` or the ADE assets change. A crash ends the loop: `restart: on-failure` retries it with backoff, then Compose marks the worker `failed`.

In terminal 2, also from the project root, call the worker:

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

## Change the greeting

The greeting is a `configuration` entry with id `my-worker`. The worker seeds it with `Hello` on its first start and reloads it on every update. Edit it in the ADE page's Settings (Save calls the internal `my-worker::set-greeting`), or from a terminal:

```sh
iii trigger configuration::set --json '{"id":"my-worker","value":{"greeting":"Hi"}}'
```

## Security

Port 3111 has no authentication: any program on this machine can load the page and call the functions it exposes. The worker answers only from allowlists (two asset names, and the functions in `API_FUNCTIONS` in `src/web.ts`: `hello`, not `my-worker::set-greeting`, so only the ADE changes the greeting). Keep the `http` worker on `127.0.0.1` and never expose port 3111 through a public proxy or tunnel.

## Tests, types and build

```sh
(cd workers/my-worker && pnpm test && pnpm typecheck && pnpm build)
```

`workers/my-worker/README.md` describes the worker's files and how to expose another function to the page.
