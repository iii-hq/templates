# my-worker

A model-driven record app. `src/model.ts` describes the records; the backend, the ADE admin page and the tests adapt to it. Out of the box the model is a todo list (`items` with `title` and `done`).

## The model

```ts
export const MODEL = {
  resource: 'items',     // my-worker::items::list|get|create|update|remove; state key
  title: 'Items',        // headings in the admin page
  titleField: 'title',   // the string field a record is shown by
  fields: {
    title: { type: 'string', label: 'Title', required: true, max: 200 },
    done: { type: 'boolean', label: 'Done', default: false },
  },
  listColumns: ['title', 'done'],
  sort: [{ field: 'done' }, { field: 'created_at', dir: 'desc' }],
} as const satisfies Model
```

- Field types: `string`, `number`, `boolean`. Options: `label`, `required?`, `default?`, `min?`/`max?` (string: trimmed length; number: value), `unique?` (string only, compared trimmed and case-insensitively).
- Every record also has `id` (uuid), `created_at` and `updated_at` (epoch ms). These names are reserved.
- `checkModel` (`src/record.ts`) rejects a broken model at startup and in `test/model.test.ts`.

## What it registers

| Kind | Id | Notes |
|---|---|---|
| Function | `my-worker::<resource>::list` | `{}` → `{ records, counts }`; sorted by `MODEL.sort`; `counts` is `{ total }` plus one number per boolean field (how many are true) |
| Function | `my-worker::<resource>::get` | `{ id }` → `{ record }` |
| Function | `my-worker::<resource>::create` | `{ ...fields }` → `{ record }`, checked against the model (type, required, min/max, unique, defaults) |
| Function | `my-worker::<resource>::update` | `{ id, ...fields? }` → `{ record }`, at least one field |
| Function | `my-worker::<resource>::remove` | `{ id }` → `{ record }` |
| Action | `my-worker::<resource>::toggle` | `{ id, field }` → `{ record }`: flip a boolean field. Public |
| Function | `my-worker::model` | Internal. `{}` → `{ model, public_actions }` for the pages |
| Trigger type | `my-worker:change` | Fires after every persisted write with `{ event, record, records }` (`created`, `updated`, `removed`). Config `{ events?, metadata? }`; the binding's metadata is merged with `config.metadata` (config wins) |
| State | scope `my-worker`, key `<resource>` | The records as one JSON array |
| HTTP | `GET /my-worker`, `GET /my-worker/:file`, `POST /my-worker/api/:fn` | `fn` is `list`, `get`, `create`, `update`, `remove`, `model` or a name in `PUBLIC_ACTIONS` |
| HTTP | `/my-worker/<path>` per `PUBLIC_ROUTES` entry | One internal function `my-worker::route::<method>::<path>` and one http trigger each; none by default |

## Files

| Path | Per app? | Role |
|---|---|---|
| `src/model.ts` | **yes** | The app: resource, fields, list columns, sort |
| `src/actions.ts` | optional | Domain actions, `PUBLIC_ACTIONS` (ships `toggle`) and `PUBLIC_ROUTES` (ships none) |
| `web/App.tsx`, `web/app.css` | **yes** | The public page, written for your records (ships one for the default model) |
| `web/client.ts` | no | `call(name, payload)` and `createApi(client)`: `api.list()`, `api.create(...)`, … |
| `src/record.ts` | no | `Model`, `checkModel`, validation, create/update/remove, parse, sort, counts, schemas |
| `src/functions.ts` | no | `registerDomain`: CRUD and `my-worker::model` from the model |
| `src/store.ts` | no | `createCollection`: state, one write queue, the `my-worker:change` trigger type |
| `src/web.ts` | no | HTTP handlers; `API_FUNCTIONS` derived from the model and `PUBLIC_ACTIONS` |
| `src/routes.ts` | no | `PUBLIC_ROUTES` plumbing: `PublicRoute`, `redirect`, `checkRoutes`, `registerRoutes`; imports nothing from the app, so actions can use it without a cycle |
| `src/index.ts` | no | Plumbing: worker, `info`, ADE assets, HTTP routes, shutdown |
| `ui/WorkerPage.tsx`, `ui/styles.css` | no | The ADE admin page, rendered from `my-worker::model`: add form, live list, endpoints |
| `test/*.test.ts` | no | `record.test.ts` uses its own test model, so tests pass whatever the model says |

## Make it your app

1. **Edit `src/model.ts`:** the resource, the fields, the list columns and the sort. That is the whole backend and the admin.
2. **Optionally add domain actions in `src/actions.ts`** (a commented `links::visit` shows the shape) and list the public ones in `PUBLIC_ACTIONS`.
   - Need your own URL (a short link, a webhook)? Add it to `PUBLIC_ROUTES` in `src/actions.ts`: `{ method, path, handler }` answers on `/my-worker/<path>` (e.g. `GET go/:slug` returning `redirect(url)` from `src/routes.ts`). The first segment must be static; `api/...`, a one-segment GET and duplicates are refused at startup.
3. **Write the public page** in `web/App.tsx` and `web/app.css`, calling the worker through `createApi(client)` from `web/client.ts`.
4. **Run** `pnpm typecheck && pnpm test && pnpm build`.

## Commands

```sh
pnpm dev        # the dev loop Compose runs (as node scripts/dev.mjs)
pnpm start      # build, then run once
pnpm test       # node --test, no engine needed
pnpm typecheck
pnpm build      # dist/ui and dist/web, with the strict worker-ui lint
```
