# my-worker

A Node/TypeScript worker project with one function, `my-worker::hello`, and one screen. The screen is a single React component, `workers/my-worker/ui/App.tsx`, shown in two places: as a page inside the ADE, and as a standalone page at `http://127.0.0.1:3111/my-worker`, served by the `http` worker.

## Prerequisites

- iii 0.24.2 or newer
- Node.js 22 or newer
- pnpm 10 or newer (`corepack enable pnpm` installs it)

## Start and call

In terminal 1, from the project root, start Compose in the foreground:

```sh
iii compose --up
```

Compose runs `pnpm install` (`pre_run`) in `workers/my-worker`, then `pnpm dev`. The dev loop builds the page, rebuilds it on every save, and restarts the worker when `src/` or the ADE assets change.

In terminal 2, also from the project root, call the worker:

```sh
iii trigger my-worker::hello name=World
```

Expected response:

```json
{ "message": "Hello, World!" }
```

## Open the page

- **Browser:** `http://127.0.0.1:3111/my-worker`. The page calls the worker through `POST /my-worker/api/hello`.
- **ADE:** uncomment the `ade` container in `worker-compose.yaml` and restart Compose, then open `http://127.0.0.1:3113` and pick the `my-worker` page. Alone, it is at `http://127.0.0.1:3113/#/worker/my-worker/my-worker`. Inside the ADE the page calls the worker through the console's own connection, not over HTTP.

## Change the greeting

The greeting is a `configuration` entry with id `my-worker`. The worker seeds it with `Hello` on its first start and reloads it on every update:

```sh
iii trigger configuration::set --json '{"id":"my-worker","value":{"greeting":"Hi"}}'
```

## Security

Port 3111 has no authentication: any program on this machine can load the page and call the functions it exposes. The worker answers only from allowlists (two asset names, and the functions in `API_FUNCTIONS` in `src/web.ts`). Keep the `http` worker on `127.0.0.1` and never expose port 3111 through a public proxy or tunnel.

## Tests, types and build

```sh
(cd workers/my-worker && pnpm test && pnpm typecheck && pnpm build)
```

`workers/my-worker/README.md` describes the worker's files and how to expose another function to the page.
