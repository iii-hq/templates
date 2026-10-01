# my-worker

An iii worker with one function and one screen that runs in the ADE and in a plain browser.

## What it registers

| Kind | Id | Notes |
|---|---|---|
| Function | `my-worker::hello` | `{ name? }` → `{ message }`, using the configured greeting |
| Configuration | `my-worker` | `{ greeting }`, seeded with `Hello`, reloaded by `my-worker::config-changed` |
| Trigger type | `my-worker:hello` | Fires after every greeting with `{ name, message }`; a binding's `metadata` is passed through |
| ADE assets | `my-worker/page.js`, `my-worker/styles.css` | Served by `my-worker::ui-content` from `dist/ui` |
| HTTP | `GET /my-worker`, `GET /my-worker/:file`, `POST /my-worker/api/:fn` | Page, `app.js`/`styles.css`, allowlisted functions |

## Files

| Path | Role |
|---|---|
| `src/index.ts` | Registrations: functions, configuration, trigger type, ADE assets, HTTP routes |
| `src/hello.ts` | Pure domain logic, tested without an engine |
| `src/web.ts` | HTTP handlers and their allowlists |
| `ui/App.tsx` | The screen: React, `lucide-react` icons, scoped CSS from `ui/styles.css` |
| `ui/client.ts` | `hostClient` (ADE, `host.iii`) and `httpClient` (browser, `fetch`) |
| `ui/page.tsx` | ADE entry: registers the page |
| `web/` | Standalone entry, its HTML, and the tokens the ADE would otherwise provide |
| `ui/build.mjs` | Builds `dist/ui` (ADE) and `dist/web` (browser) |
| `scripts/dev.mjs` | `pnpm dev`: build, watch, and restart the worker on change |

## Expose another function to the page

1. Register it in `src/index.ts` as `my-worker::<name>`.
2. Add `<name>` to `API_FUNCTIONS` in `src/web.ts`. Port 3111 has no auth, so list only what any local program may call.
3. Call it from `ui/App.tsx` with `client.call('<name>', payload)`. The same call goes through `host.iii` in the ADE and through `POST /my-worker/api/<name>` in the browser.

## Commands

```sh
pnpm dev        # what Compose runs
pnpm test       # node --test, no engine needed
pnpm typecheck
pnpm build      # dist/ui and dist/web
```
