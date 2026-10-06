# my-worker

A model-driven Node/TypeScript record app. `workers/my-worker/src/model.ts` describes the records; from it the worker registers `my-worker::<resource>::list|get|create|update|remove`, a `my-worker:change` trigger type and the ADE admin page (`workers/my-worker/ui/WorkerPage.tsx`). The public page users open at `http://127.0.0.1:3111/my-worker` (`workers/my-worker/web/App.tsx`) is written per app; the template ships one for its default todo model (`items` with `title` and `done`).

## Prerequisites

- iii 0.24.2 or newer, with the state worker
- Node.js 22 or newer
- pnpm 10 or newer (`corepack enable pnpm` installs it)

## Start and call

In terminal 1, from the project root, start Compose in the foreground:

```sh
iii compose --up
```

Compose runs `pnpm install` (`pre_run`) in `workers/my-worker`, then `node scripts/dev.mjs`, which builds the pages, rebuilds them on every save, and restarts the worker when `src/` or the ADE assets change.

In terminal 2, add an item and read the list:

```sh
iii trigger my-worker::items::create title=First
iii trigger my-worker::items::list
```

Expected list response:

```json
{ "records": [{ "id": "…", "title": "First", "done": false, "created_at": 1760000000000, "updated_at": 1760000000000 }], "counts": { "total": 1, "done": 0 } }
```

## Open the pages

- **Public page:** `http://127.0.0.1:3111/my-worker`. Live counts, an add field, filters, complete, remove and clear done; it calls `POST /my-worker/api/:fn` and refreshes every 4 seconds.
- **Admin, in the ADE:** uncomment the `ade` container in `worker-compose.yaml`, restart Compose, open `http://127.0.0.1:3113` and pick the `my-worker` page. It renders from `my-worker::model`: an add form from the fields, a live list of the `listColumns` (re-fetched on every `my-worker:change`), toggles, inline edit, remove and the endpoints.

## Make it your app

1. Edit `workers/my-worker/src/model.ts`: resource, fields (`string`, `number`, `boolean`), list columns, sort.
2. Optionally add domain actions in `src/actions.ts` and list the public ones in `PUBLIC_ACTIONS`; give an action its own URL (a short link `GET go/:slug` answering `302`) with `PUBLIC_ROUTES` there.
3. Write the public page in `web/App.tsx` and `web/app.css`.
4. Run `pnpm typecheck && pnpm test && pnpm build` in `workers/my-worker`.

`workers/my-worker/README.md` has the model options, the functions and the files.

## React to changes

Bind any function to `my-worker:change`; it receives `{ event, record, records }` after every write:

```json
{ "type": "my-worker:change", "function_id": "<your function>", "config": { "events": ["created"], "metadata": { "from": "me" } } }
```

## Security

Port 3111 has no authentication: any program on this machine can load the page and call the functions it exposes. The worker answers only from allowlists (two asset names, and the names in `API_FUNCTIONS` in `src/web.ts`). Keep the `http` worker on `127.0.0.1` and never expose port 3111 through a public proxy or tunnel.
