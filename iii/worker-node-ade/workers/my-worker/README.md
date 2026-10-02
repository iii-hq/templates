# my-worker

An iii worker with one function and one page: built from the console's components in the ADE, and a plainer version of the same call in a plain browser.

## What it registers

| Kind | Id | Notes |
|---|---|---|
| Function | `my-worker::hello` | `{ name? }` → `{ message }`, using the configured greeting |
| Function | `my-worker::info` | Internal. `{}` → `{ web_url, greeting }`: where the standalone page answers (`III_HTTP_URL`, default `http://127.0.0.1:3111`, plus `/my-worker`) and the live greeting. Feeds the ADE page's **Open outside console** button |
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
| `ui/WorkerPage.tsx` | The ADE page: `@iii-dev/console-ui` components (the console supplies them at runtime), calling `host.iii` |
| `ui/App.tsx` | The standalone page: plain React, `lucide-react` icons, scoped CSS from `ui/styles.css` |
| `ui/client.ts` | The `Client` type and `httpClient` (standalone page, `fetch`); `hostClient` wraps `host.iii` in the same shape |
| `ui/page.tsx` | ADE entry: registers `WorkerPage` |
| `web/` | Standalone entry, its HTML, and the tokens the ADE would otherwise provide |
| `ui/build.mjs` | Builds `dist/ui` (ADE) and `dist/web` (browser) |
| `scripts/dev.mjs` | `pnpm dev`: build, watch, and restart the worker on change |

## Expose another function to the page

1. Register it in `src/index.ts` as `my-worker::<name>`.
2. Add `<name>` to `API_FUNCTIONS` in `src/web.ts`. Port 3111 has no auth, so list only what any local program may call.
3. Call it from `ui/WorkerPage.tsx` with `host.iii.trigger('my-worker::<name>', payload)` in the ADE, and from `ui/App.tsx` with `client.call('<name>', payload)` in the browser, which goes through `POST /my-worker/api/<name>`.

## Commands

```sh
pnpm dev        # what Compose runs
pnpm test       # node --test, no engine needed
pnpm typecheck
pnpm build      # dist/ui and dist/web
```
