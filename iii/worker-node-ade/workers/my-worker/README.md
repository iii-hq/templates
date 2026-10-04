# my-worker

An iii worker with one function and two pages: the public page users open in a browser, with its own design, and the worker's admin in the ADE, built from the console's components.

## What it registers

| Kind | Id | Notes |
|---|---|---|
| Function | `my-worker::hello` | `{ name? }` → `{ message }`, using the configured greeting |
| Function | `my-worker::info` | Internal. `{}` → `{ web_url, web_path, greeting }`: where the public page answers (`web_url` is `III_HTTP_URL` plus `/my-worker`, or `null` when it is unset; `web_path` is `/my-worker`) and the live greeting. Feeds the ADE page's **Open public page** button |
| Function | `my-worker::set-greeting` | Internal. `{ greeting }` → `{ greeting }`: trimmed, 1 to 40 characters, saved in the `my-worker` configuration. The ADE page's Save calls it; it is not on the HTTP allowlist |
| Configuration | `my-worker` | `{ greeting }`, seeded with `Hello`, reloaded by `my-worker::config-changed` |
| Trigger type | `my-worker:hello` | Fires after every greeting with `{ name, message }`; a binding's `metadata` is passed through |
| ADE assets | `my-worker/page.js`, `my-worker/styles.css` | Served by `my-worker::ui-content` from `dist/ui` |
| HTTP | `GET /my-worker`, `GET /my-worker/:file`, `POST /my-worker/api/:fn` | Page, `app.js`/`styles.css`, allowlisted functions |

## Files

| Path | Role |
|---|---|
| `src/index.ts` | Registrations: functions, configuration, trigger type, ADE assets, HTTP routes |
| `src/hello.ts` | Pure domain logic (the greeting and its validation), tested without an engine |
| `src/ui-assets.ts` | `my-worker::ui-content`: reads `dist/ui` on request, so a start without a build still runs |
| `src/web.ts` | HTTP handlers and their allowlists |
| `ui/WorkerPage.tsx` | The ADE page, the worker's admin: Settings, Test and Endpoints, built from `@iii-dev/console-ui` components (the console supplies them at runtime), calling `host.iii` |
| `ui/page.tsx` | ADE entry: registers `WorkerPage` |
| `ui/styles.css` | The admin page's layout, with design tokens only |
| `web/App.tsx`, `web/app.css` | The public page: plain React with its own design, palette (light and dark) and type; the console's lint and tokens do not apply to it |
| `web/client.ts` | The `Client` type and `httpClient` (public page, `fetch`) |
| `web/main.tsx`, `web/index.html` | Public page entry and its HTML |
| `ui/build.mjs` | Builds `dist/ui` (admin) and `dist/web` (public) |
| `scripts/dev.mjs` | `pnpm dev`: build, watch, and restart the worker on change; a crash ends it |

## Expose another function to the page

1. Register it in `src/index.ts` as `my-worker::<name>`.
2. Add `<name>` to `API_FUNCTIONS` in `src/web.ts`. Port 3111 has no auth, so list only what any local program may call.
3. Call it from `ui/WorkerPage.tsx` with `host.iii.trigger('my-worker::<name>', payload)` in the ADE, and from `web/App.tsx` with `client.call('<name>', payload)` in the public page, which goes through `POST /my-worker/api/<name>`.

## Commands

```sh
pnpm dev        # the dev loop Compose runs (as node scripts/dev.mjs)
pnpm start      # build, then run once: what a plain `compose::add` of this folder runs
pnpm test       # node --test, no engine needed
pnpm typecheck
pnpm build      # dist/ui and dist/web
```
