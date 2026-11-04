---
name: iii-node
description: >-
  Scaffold portable TypeScript/Node.js iii workers from the `worker-node-ade`
  template with `coder::scaffold-worker`, declare them through `compose::add`,
  and maintain them: a single-package backend, an admin page in the iii Console
  plus a public page over HTTP for users, configuration integration, and
  coordinated development watchers.
---

# iii-node

Use this skill to create or restructure a Node.js/TypeScript iii worker, especially when the worker ships an injectable UI into the iii Console. A new worker is scaffolded from the `worker-node-ade` template, never written by hand (Scaffold a new worker); the rest of this file holds the conventions that still apply when you edit it. This skill is self-contained and may be copied into a different project; do not assume any example worker, monorepo, sibling package, or repository-specific path exists.

## Required references

Read the relevant references before implementing:

- [`configuration.md`](./configuration.md) — bundled beside this file: schema-validated configuration registration, reads, updates, and observing `configuration::on-updated`.
- The UI half lives in the `ade-worker-design` skill (`directory::skills::get { "id": "harness/ade-worker-design/<name>" }`):
  - `console-injectable-ui` — the complete injectable UI contract, host APIs, asset registration, hot reload, responsiveness, and validation requirements.
  - `console-design` — the Console visual system, component grammar, tokens, typography, spacing, and interaction rules.
  - `patterns` — concrete recipes for record-shaped UIs: boards with lanes and drag-and-drop, a record screen that opens as its own pane, activity timelines with threaded comments, creation modals, chat cards for agent calls, settings forms, and live updates.

This file still owns the worker-side half of an injectable UI — the build script, the asset content function and its `ade::ui::asset` observers, the dev watchers — because those ship inside the worker package. The pages, renderers, forms and styles themselves are the Frontend Engineer's work; when a task needs them, name the gap in your result rather than improvising markup here.

### Precedence for this Node scaffold

This file and the `worker-node-ade` template it scaffolds are the source of truth for the **single-package Node layout, npm dependency, build outputs, worker-side UI delivery, the public page and its HTTP API, development process, and Compose declaration**. Use the references above as the source of truth for the **current host API, UI components, accessibility, responsive behavior, configuration semantics, and visual design**.

The injectable UI reference may describe repository-internal `workspace:*` dependencies, local `file:` dependencies, a root workspace file, or a separate `<worker>/ui/package.json`. Those instructions do **not** apply to this portable Node scaffold. Use one package at the worker root and consume the public npm package:

```json
"@iii-dev/console-ui": "0.2.0"
```

Do not use `file:`, `link:`, or `workspace:*` for this dependency.

Any repository path mentioned by a reference—such as `packages/console-ui`, `console/`, `database/`, `state/`, `iii-directory/`, or `app/`—is an optional upstream example, not a required destination-project file. If such a path is absent, do not search for it, recreate its surrounding monorepo, or block implementation on it. Use the scaffolded worker, the installed `@iii-dev/console-ui` public types, and the runtime contracts available in the destination project.

## Choose project identifiers once

Before scaffolding, resolve these placeholders and use them consistently:

| Placeholder | Meaning | Example form |
|---|---|---|
| `<worker-name>` | Stable lowercase worker identity used by iii and asset paths | `issue-board` |
| `<worker-directory>` | Directory containing the worker package, relative to `worker-compose.yaml` | `./workers/issue-board` |
| `<worker-title>` | Human-readable title in natural casing | `Issue board` |
| `<worker-description>` | One-line capability description | `Tracks project issues and activity.` |
| `<configuration-id>` | Stable configuration form family; normally `<worker-name>` | `issue-board` |
| `<page-id>` | Globally distinct Console extension page id | `issue-board-manager` |
| `<env-prefix>` | Upper-snake-case environment prefix derived from the worker name | `ISSUE_BOARD` |

`<worker-name>` must match `^[a-z][a-z0-9]*(-[a-z0-9]+)*$` and be 1–63 characters long: lowercase letters and digits in hyphen-separated parts, starting with a letter. `coder::scaffold-worker` refuses any other name. It replaces the template's `my-worker` token with `<worker-name>` in every path and text file, so these already agree after scaffolding; keep them consistent when you edit:

- `registerWorker({ workerName })`;
- function ids such as `<worker-name>::resource::action`;
- UI content function id `<worker-name>::ui-content`;
- injectable asset paths `<worker-name>/page.js` and `<worker-name>/styles.css`;
- CSS scope `[data-iii-ui="<worker-name>"]`;
- the HTTP prefix `/<worker-name>`;
- configuration id unless the domain requires a separate stable form family;
- `package.json` and `iii.worker.yaml` name;
- the `worker-compose.yaml` container key, which is the last segment of the worker's directory; the scaffold makes that segment `<worker-name>`.

Do not copy an example name into generated code, and replace every angle-bracket placeholder you copy from this file. Use lowercase `[a-z0-9._-]` path segments for injectable assets. Never derive identifiers from a display title at runtime.

## Scaffold a new worker

Never hand-write a new worker's package. The `ide` worker copies the `worker-node-ade` template from `iii-hq/templates`, which holds everything this file describes (Project shape).

1. `coder::list-templates {}` lists the templates it can scaffold. Confirm `worker-node-ade` is among them. When `source.warning` is set, the list came from a stale cache: call it once more with `{ "refresh": true }` before you conclude a template is missing.
2. Arm the operation wake (`harness::observe` of `compose::on-operation-progress`) on an `operation_id` you pick (Declare the worker with `compose::add` describes it), then scaffold and start the package in one call:

   ```json
   coder::scaffold-worker { "template": "worker-node-ade", "name": "<worker-name>", "operation_id": "<operation id>" }
   ```

   It writes the files into `workers/<worker-name>`, relative to the session root, then adds the worker to the stack in the same call: `compose::add` with the worker and every `requires` container the stack lacks (`http`). Never pass `start_after` naming the console container (see Declare the worker with `compose::add`). Pass `directory` only when the architecture names another folder, and end it with `/<worker-name>`. The result is `{ directory, files, compose, compose_add, requires, operation_id, started, next_steps }`: `directory` and every `files[].path` are absolute, and the wake fires when `operation_id` ends. `next_steps` are written for people; follow this section instead, and never restart the project to start the worker.

   The call writes every file or none. It refuses an invalid name, an unknown template, a folder whose last segment is not the name, a folder outside the session's writable roots, a folder that exists and is not empty, and (C235, before any write) a name the stack already has a container for. Never delete a folder to retry: when it already holds this worker, edit it in place; otherwise choose another parent folder or name and say why. When the templates are unavailable (no cache and no network), report it and stop.
3. When the result has a `start_error`, or a note that it was not started (its `compose::add` needs approval, for one), the files are written but the worker is not in the stack: declare it yourself, `compose::add` with `compose_add` whole and the step 2 `operation_id` (Declare the worker with `compose::add`).

If `engine::functions::info` reports `coder::scaffold-worker` as not available, the project's `ide` worker predates it: tell the user it needs an update and stop. Do not hand-write the package instead.

## Project shape

The scaffold writes one Node package; the backend, the ADE assets and the public page share it:

```text
<worker-directory>/
  package.json          # pnpm: iii-sdk, @iii-dev/console-ui, react, lucide-react, esbuild, tsx, typescript
  pnpm-workspace.yaml   # allowBuilds: esbuild
  tsconfig.json
  iii.worker.yaml
  scripts/dev.mjs       # Development loop
  src/
    index.ts            # registerWorker, functions, configuration, event function, ADE asset and HTTP route observers
    hello.ts            # domain logic of the example function
    ui-assets.ts        # ui-content: the ADE assets, read on request
    web.ts              # HTTP handlers and their allowlists
  ui/
    WorkerPage.tsx      # the ADE page, the worker's admin: console-ui components, host.iii
    page.tsx            # ADE entry: setup(host)
    styles.css          # admin layout: scoped, tokens only
    build.mjs           # ADE assets + public page bundle
    tsconfig.json       # also covers ../web
  web/                  # the public page: not injected into the console
    App.tsx             # the page users open: plain React, client
    app.css             # its own palette, type and spacing, light and dark
    client.ts           # httpClient(base)
    main.tsx            # entry
    index.html
  test/                 # hello.test.ts, ui-assets.test.ts, web.test.ts (allowlists, 404s)
  dist/                 # generated; do not hand-edit
    ui/                 # page.js, styles.css: the ADE assets
    web/                # index.html, app.js, styles.css: the public page
```

Keep domain logic, validation, persistence, and iii registrations under `src/`; the ADE page and the other ADE-only surfaces under `ui/`; the public page under `web/`. The UI reaches the backend only through `host.iii` (ADE page) or its `client` (public page); it never imports backend modules or reads backend files.

When you edit the package:

- Keep the scaffolded `iii-sdk` version; never guess another. Change it only to a published version you validated against the current SDK reference.
- Add a dependency with `pnpm add <package>` in the worker directory. pnpm 10+ runs no dependency build script until it is approved, and pnpm 11 re-checks before every `pnpm run`, so `pnpm test` and `pnpm build` fail with `ERR_PNPM_IGNORED_BUILDS` after an install that “succeeded”. Approve it under `allowBuilds` in `pnpm-workspace.yaml` (`false` for packages that need no script), never with the interactive `pnpm approve-builds`, and install again.
- `ui/tsconfig.json` extends `@iii-dev/console-ui/tsconfig.worker-ui.json`, which already sets the target, DOM lib, bundler resolution, `react-jsx`, `strict` and `noEmit`; do not restate them.
- Use explicit `.js` extensions in relative backend imports when `NodeNext` requires them, even though the source file ends in `.ts`.

## Node SDK rules

Before writing or changing worker SDK code, read the current Node SDK reference at <https://iii.dev/docs/reference/sdk-node.md>. Do not write SDK calls from memory.

Import the factory and call registration methods on the returned client:

```ts
import { registerWorker } from 'iii-sdk'

const iii = registerWorker(
  process.env.III_ENGINE_URL ?? process.env.III_URL,
  {
    workerName: '<worker-name>',
    workerDescription: '<worker-description>',
    invocationTimeoutMs: 30_000,
  },
)
```

If passing `undefined` as the address is incompatible with the installed SDK types, omit the first argument and let `III_URL` resolve according to the current SDK reference. Do not invent connection setup beyond the documented API.

Import only actual top-level SDK exports such as `registerWorker` and, when needed, `CallAction`, `ObserveRejection`, `EngineSources` or documented types. Do not import or destructure `registerFunction`, `call`, `observe`, or other client methods as top-level exports. Call `iii.registerFunction(...)`, `iii.call(...)`, `iii.observe(...)`, and the hook methods `iii.onObserverAdded(...)`, `iii.onObserverRemoved(...)`, `iii.onObserverMatch(...)` and `iii.onObserverDeliver(...)`. The `IIIClient`, `FunctionRef`, `Observer`, `Call` and `Observed` types come from `iii-sdk`.

### SDK shapes (`iii-sdk` 0.26, `dist/*.d.mts`)

```ts
registerWorker: (address?: string, options?: InitOptions) => IIIClient
IIIClient.registerFunction: <I = any, O = any>(functionId: string, handler: RemoteFunctionHandler<I, O> | HttpInvocationConfig, options?: RegisterFunctionOptions) => FunctionRef<I, O>
RemoteFunctionHandler<TInput = any, TOutput = any>: (data: TInput, metadata?: JsonValue) => TOutput | Promise<TOutput>  // two arguments; metadata is never inside the payload
RegisterFunctionOptions: { description?; request_format?; response_format?; metadata?: Record<string, unknown>; invocation?: HttpInvocationConfig; args_format?; private?: boolean; observable?: boolean; standby?: boolean; localDispatch?: boolean }
FunctionRef<I, O>: { readonly id: string; onObserverAdded(hook); onObserverRemoved(hook); onObserverMatch(hook); onObserverDeliver(hook); observers(): readonly Observer[]; isObserved(call?): boolean; unregister(): void }  // hook setters return the ref
IIIClient.observe: (source: string | ObserveSource, target: Target, options?: ObserverOptions) => ObserverHandle
ObserveSource: { function_id: string; namespace?: string; args?: Record<string, unknown>; filters?: Filter; on?: 'success' | 'error' | 'complete'; capture?: Capture[]; deliver?: 'envelope' | 'input' | 'output' }
Target: string | { function_id: string; namespace?: string }
ObserverOptions: { id?: string; max_fires?: number; expires_in_ms?: number; max_in_flight?: number; metadata?: Record<string, unknown> }
ObserverHandle: { readonly id: string; readonly state: 'pending' | 'active' | 'suspended' | 'error' | 'disposed'; readonly reason?: { code: string; message: string }; ready(): Promise<void>; onStateChange(listener): () => void; dispose(): Promise<void> }
IIIClient.call: <TInput = unknown, TOutput = any>(request: CallRequest<TInput>) => Promise<TOutput>  // `trigger` is a deprecated alias
CallRequest<TInput>: { function_id: string; payload: TInput; action?: CallAction; timeoutMs?: number; metadata?: unknown; namespace?: string; dispatch?: 'auto' | 'remote' }
CallAction: CallAction.Void() (fire-and-forget) | CallAction.Enqueue({ queue })
IIIClient.shutdown: () => Promise<void>
```

`registerTrigger`, `registerTriggerType` and the `iii-sdk/trigger` subpath are gone in 0.26: a worker that still calls `registerTrigger` crashes (`iii.registerTrigger is not a function`), and an older SDK's trigger registrations are dropped by a 0.26 engine without an error the worker sees.

### Namespaces

A Compose project usually runs its workers in a project namespace (`III_NAMESPACE` is set by Compose); the engine-hosted workers (`configuration`, `engine::*`) live in `default`. Consequences:

- Calls to engine-hosted functions from the worker need `namespace: 'default'` on `iii.call`; calls to the worker's own functions and other project workers omit it.
- `iii.observe` of an engine-hosted function (`configuration::on-updated`, `engine::on-functions-changed`) and of another project worker's function (`ade::ui::asset`) resolves without a `namespace` on the source; do not set one.
- An event function the worker registers itself lands in the worker's namespace; console tabs and the harness observe it without extra configuration.
- The harness and the console reach the worker's functions by bare id; never prefix ids with a namespace.
- A worker process you start yourself for checks (`node src/index.mjs`, `nohup …`) does not inherit `III_NAMESPACE` and lands in `default`, where the harness and the console cannot reach it: its functions answer `function_not_found`. Prefer the copy Compose runs. When you must start one, set `III_NAMESPACE=<project namespace>` (the namespace the project's workers show in `engine::functions::list` results), never run it beside the Compose copy, and stop it before ending the turn.

Every public function must provide:

- a stable namespaced id such as `<worker-name>::resource::action`;
- a concise description;
- `request_format` and `response_format` JSON Schemas;
- a handler whose input/output actually matches those schemas.

The engine adds `_`-prefixed fields such as `_caller_worker_id` to every payload it delivers. Handler-side validation that rejects unknown fields must ignore keys that start with `_`; otherwise every real call fails with `Unexpected field(s): _caller_worker_id`.

A small helper can keep registrations consistent:

```ts
function registerFunction<TInput, TOutput>(
  id: string,
  description: string,
  requestFormat: Record<string, unknown>,
  responseFormat: Record<string, unknown>,
  handler: (payload: TInput) => Promise<TOutput>,
) {
  return iii.registerFunction(id, handler, {
    description,
    request_format: requestFormat,
    response_format: responseFormat,
  })
}
```

Handle shutdown cleanly:

```ts
const shutdown = async () => {
  await iii.shutdown()
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
```

Keep data validation and domain logic in backend modules rather than duplicating it in the injected UI.

## Configuration

Follow [`configuration.md`](./configuration.md). For a configurable worker:

1. Choose a stable `<configuration-id>`, normally `<worker-name>`.
2. Read any existing value before registration when preserving operator data matters.
3. Call `configuration::register` at startup with an id, name, description, JSON Schema, and an `initial_value` only when no value exists.
4. Read and validate the effective value before constructing resources that depend on it.
5. Register an internal reload function with accurate request/response schemas and `metadata: { internal: true }` when appropriate.
6. Observe `configuration::on-updated` with that function as the target, filtered on `input.id` and `input.event_type`, with `deliver: 'output'`.
7. In the UI, register a purpose-built form with `host.configForms.register(...)`; never fall back to a raw JSON textarea.
8. Set `configurationId` on the page registration so the Console exposes the standard settings action.

The `worker-*-ade` templates take the shorter path: one `configuration::ensure` call (its `initial_value` is used only when nothing is stored), then `configuration::get`, and no form. Their greeting is changed with `configuration::set`. Move to steps 2–3 and 7–8 when you add a settings form.

A worker-to-worker call still routes through iii:

```ts
async function configurationCall<T>(
  functionId: string,
  payload: Record<string, unknown>,
): Promise<T> {
  return iii.call({
    function_id: functionId,
    namespace: 'default',
    payload,
    timeoutMs: 10_000,
  }) as Promise<T>
}
```

Use an explicit namespace only when required by the destination deployment (see Namespaces above; `default` is required for `configuration::*` when the project runs under a Compose namespace). Copy the event fields from `engine::functions::info { function_id: 'configuration::on-updated' }` rather than assuming them. Preserve unknown configuration fields and `${ENV:default}` templates as required by the bundled references.

Contract details the live registry does not advertise:

- `configuration::register` is hidden from `engine::functions::list` and `engine::functions::info` reports it as not available; it still exists (see `engine::workers::info { name: 'configuration' }`). Its payload is `{ id, name, description, schema, initial_value?, metadata: { ui_form: '<configuration-id>' } }`. Re-registering with `initial_value` **replaces** the stored value, so pass it only when the read below returned nothing.
- `configuration::get { id }` throws when the id is not registered yet; treat that error as “no value” during startup, register, then read again (with defaults expanded) to obtain the effective value.
- The persisted file is `<config dir>/<id>.yaml` with `id`, `name`, `description`, `metadata`, and `value`.
- `configuration::on-updated` is called with `{ type: 'configuration', event_type, id, name, description, schema, old_value, new_value, metadata }`; observe it with `filters: { 'input.id': { $eq: '<configuration-id>' }, 'input.event_type': { $eq: 'configuration:updated' } }` and `deliver: 'output'`.
- Relative paths in configuration should resolve from a stable root. Resolve them against the project root (the nearest ancestor of the worker directory that contains `worker-compose.yaml`, overridable by an env var), not the process cwd, and expose the resolved path through a small `<worker-name>::config::info` function so the settings form can show it.

## Live updates (the worker's event function)

When other tabs, agents, or workers must react to changes without polling, the worker hosts an event function: a private function whose handler returns the event it is called with. The worker calls it after every persisted mutation, and iii delivers each call to the observers whose filters match:

```ts
import { CallAction } from 'iii-sdk'

const ON_CHANGE_FN = '<worker-name>::on-change'

type ChangeEvent = {
  event: string // e.g. 'record.updated', 'store.reloaded'
  record_id?: string
  record?: Record<string, unknown>
}

iii.registerFunction(ON_CHANGE_FN, (event: ChangeEvent) => event, {
  description:
    'Called after every persisted mutation with the whole record. No args; filter on input.event or input.record_id.',
  request_format: changeEventSchema,
  response_format: changeEventSchema,
  private: true, // everyone may observe it; only this worker calls it
})

function emit(event: ChangeEvent) {
  if (!iii.isObserved(ON_CHANGE_FN)) return // one atomic load while nothing observes it
  iii
    .call({ function_id: ON_CHANGE_FN, payload: event, action: CallAction.Void() }) // delivery does not wait for targets
    .catch((error) => console.error('[<worker-name>] emit failed', error))
}
```

Emit from the store after each persisted mutation and include the **whole record** in the payload so consumers can upsert without a round trip. The function takes no args: consumers choose calls with filters on its `input`. The UI side of this contract is in the designer's `console-injectable-ui` (`host.iii` → live data) and `patterns` §8.

Another worker observes it with a function of its own as the target:

```ts
iii.observe(
  {
    function_id: '<worker-name>::on-change',
    filters: { 'input.record_id': { $eq: recordId } },
    deliver: 'output', // the target receives the event itself
  },
  'other-worker::on-record-change',
  { metadata: { reason: 'sync' } },
)
```

An observer's `metadata` stays with the engine: its target receives it as the handler's **second argument** on every call, a channel separate from the payload. The worker that hosts the event function neither sees nor forwards it, so never merge metadata into the payload.

### Observer hooks: setup, matching and delivery

By default iii accepts every observer, delivers every call to each observer whose filters match, and gives the caller the handler's return value. A function that needs more overrides one default with a hook, set on the client by function id or chained on the `FunctionRef` that `registerFunction` returns:

| Hook | Set it when | The default it overrides |
|---|---|---|
| `onObserverAdded(obs)` | each observer needs something set up (a timer, a watch, a subscription); throw `ObserveRejection` to refuse it | accept the observer |
| `onObserverRemoved(obs)` | that setup must be torn down | forget the observer |
| `onObserverMatch(obs, call)` | the observer's `args` say which calls it wants | every observer wants every call |
| `onObserverDeliver(call, observers)` | each call goes to one observer, or the caller needs the target's answer | deliver to every match and return the handler's value |

`args` belong to the worker that hosts the function and `filters` to iii. A function takes args only when an observer needs its own setup or its own calls; it declares them with `args_format`, and the engine validates every observer's args against it (`INVALID_ARGS`). Everything else is a filter on `input`.

```ts
import { CallAction, ObserveRejection } from 'iii-sdk'

const ON_DUE_FN = '<worker-name>::on-due'

iii
  .registerFunction(ON_DUE_FN, (due: { record_id: string; due_at: number }) => due, {
    description: 'Called when a record falls due. Args: { record_id }.',
    args_format: {
      type: 'object',
      properties: { record_id: { type: 'string' } },
      required: ['record_id'],
    },
    private: true,
  })
  .onObserverAdded(async (obs) => {
    const record = await store.get(obs.args.record_id as string)
    if (!record) throw new ObserveRejection('UNKNOWN_RECORD', `no record ${obs.args.record_id}`)
    timers.retain(record.id, record.due_at, () =>
      iii.call({
        function_id: ON_DUE_FN,
        payload: { record_id: record.id, due_at: record.due_at },
        action: CallAction.Void(),
      }),
    )
  })
  .onObserverRemoved((obs) => timers.release(obs.args.record_id as string))
  // many observers: match by keys, one lookup per call
  // .onObserverMatch({ observer: (obs) => obs.args.record_id as string, call: (call) => call.input.record_id })
  .onObserverMatch((obs, call) => obs.args.record_id === call.input.record_id)
```

- Hooks of one function run one at a time. Chain them on `registerFunction`, or set them by id before it, so they see every observer.
- `onObserverRemoved` runs exactly once for every accepted observer, and never for a rejected one.
- A new observer that needs the current state gets a call of its own once it is accepted: the function is called with metadata `{ for_observer: obs.id }`, and its match hook gives that call to that observer alone. iii delivers it like every call, with the observer's `deliver`, filters and policy, so the target receives every event of the function in one shape. The added hook starts the call without awaiting it, and a rejected observer gets nothing:

```ts
const ON_STOCK_FN = '<worker-name>::on-stock-changed'

iii
  .registerFunction(ON_STOCK_FN, (event: { sku: string; available: number }) => event, { private: true })
  .onObserverAdded((obs) => {
    void obs
      .accepted()
      .then(() =>
        iii.call({
          function_id: ON_STOCK_FN,
          payload: inventory.current(),
          metadata: { for_observer: obs.id },
          action: CallAction.Void(),
        }),
      )
      .catch(() => undefined)
  })
  // a call for one observer goes to it alone, every other call to every observer
  .onObserverMatch((obs, call) => !call.metadata?.for_observer || call.metadata.for_observer === obs.id)
```

With keys, the observer function also returns `` `for_observer:${obs.id}` `` and the call function returns that one key for a call for one observer.

- A call through an observer (`iii.call({ observer, payload })`) runs its target with the observer's policy and metadata, and belongs in `onObserverDeliver`, whose function documents what its targets receive. Only the worker that hosts the observed function may make one.
- `onObserverDeliver` receives the call and the observers that matched it, delivers the call itself, and returns what the caller gets back. It applies each observer's filters with `obs.matches(call)`:

```ts
iii.onObserverDeliver('<worker-name>::on-command', async (call, observers) => {
  const handler = observers.find((obs) => obs.args.command === call.input.command)
  if (!handler || !handler.matches(call)) return { handled: false }
  return iii.call({ observer: handler, payload: call.input })
})
```

## Public page and ADE admin page

The worker has two pages, for two audiences. The **public page** is what people who use the worker open: `/<worker-name>` on the `http` worker the template requires (the `url` from `http::status`, `http://127.0.0.1:3111` by default), with a design of its own. The **ADE page** is the worker's admin, inside the console: it edits the worker's settings, tries its functions and lists its endpoints.

- `ui/WorkerPage.tsx` is the ADE page, and `ui/page.tsx` renders `<WorkerPage host={host} onClose={onRequestClose} />` (Injectable UI entrypoint). It is built from `@iii-dev/console-ui` components: `PageShell` → `PageHeader` (the iii `Wordmark` as its icon, description "Admin") → `PageMain`, `SettingsSection`/`SettingsList`/`SettingsField`/`SettingsRow`, `Input`, `Button`, `StatusPanel`, with `useContainerNarrow`, `useCopyFlash` and `errorMessage` from the `/hooks` and `/format` subpaths. It reaches the backend through `host.iii.trigger('<worker-name>::<fn>', payload)` (positional: `trigger(functionId, payload?, options?)`, as `index.d.ts` declares). The template has three sections: **Settings** (the greeting, with Save, and a `StatusPanel` for the outcome), **Test** (calls `hello` the way the public page does) and **Endpoints** (the function, the trigger type, the public page and the public API, each with a copy button).
- Settings writes go through an internal function, not a direct `configuration::set` from the page. `<worker-name>::set-greeting` takes `{ greeting }`, validates it (`normalizeGreeting` in `src/hello.ts`: trimmed, not empty, at most 40 characters), calls `configuration::set { id: '<worker-name>', value: { greeting } }` in the `default` namespace and updates the greeting it keeps in memory. It is not in the HTTP allowlist, so only the ADE changes the greeting. Give the domain's own admin edits the same shape: one internal function per write, validation in `src/<domain>.ts`, a unit test.
- The ADE page's header shows **Open public page**, a link to the public page. The internal `<worker-name>::info` function returns `web_url` (`III_HTTP_URL` plus `/<worker-name>`, `null` when `III_HTTP_URL` is unset), `web_path` (`/<worker-name>`) and the live `greeting`; the page loads them through `host.iii` and links to `web_url`, else to `web_path` on the `port` that `http::status` answers (3111 by default; never a hardcoded 3111, since another project on the machine may own it, and no link when `http::status` does not answer) of the host the console is browsed from (`window.location.hostname`, always `http:`), never a hardcoded `127.0.0.1`, because the console may be browsed from another machine. When `http::status` reports host `127.0.0.1` (the template's compose), that link answers only from the machine it runs on, while `0.0.0.0` lets other devices on the network open it; for another device use an SSH tunnel (`ssh -L <port>:127.0.0.1:<port> <host>`) or set `III_HTTP_URL`, and never expose that port on an untrusted network. `info` is not in the HTTP allowlist.
- `web/App.tsx` is the public page. It takes one prop, `client: { call<T>(fn: string, payload: unknown): Promise<T> }`, and reaches the backend only through `client.call('<fn>', payload)` with the function's bare name (`hello`, not `<worker-name>::hello`).
- `web/client.ts` holds the `Client` type and `httpClient(base)`, which POSTs the payload as JSON to `base + '/' + fn`. The ADE page does not use it: `WorkerPage.tsx` calls `host.iii.trigger('<worker-name>::<fn>', payload)` directly.
- `web/main.tsx` renders `<App client={httpClient('/<worker-name>/api')} />` into `#root` with `createRoot`. There is no `data-iii-ui` wrapper: `web/app.css` is not scoped.
- The public page is the user's own page, so it is designed as a small product, not as a console screen: the worker's name as the brand at the top, one central card holding the call's input and its result (the result shown large), a discreet "Powered by iii" footer, a warm light and dark palette that follows `prefers-color-scheme`, and the system font stack (no font files). Its palette, type and spacing are custom properties in `web/app.css`. When you adapt it, keep the structure and change the copy and the controls to the domain.
- The public page is not injected into the console, so the console's design tokens, the `data-iii-ui` scope and the design-rule lint do not apply to it; accessibility and responsiveness still do (labels, focus rings, contrast in both schemes, `prefers-reduced-motion`, stacking at phone width). It uses React, `lucide-react` icons and its own CSS, and imports nothing from `@iii-dev/console-ui` at runtime: no `PageShell`, `Button` or other component, no `/hooks` or `/format` helper; `import type` is fine. Those exist only inside the ADE, which refuses cross-origin loads of its runtime (`CORP: same-origin`, `frame-ancestors 'none'`); that is why the public page stays plain and the ADE page does not.
- Other ADE-only surfaces — configuration forms, function-call and observer-activity renderers, panels, chat cards — live in other `ui/` modules that `page.tsx` registers and the public page never imports. Like `WorkerPage.tsx`, they follow the `ade-worker-design` manuals and use `@iii-dev/console-ui` components.
- `ui/styles.css` holds only the ADE page's layout, and uses only design tokens (`var(--color-*)` and the rest) that the ADE supplies. The public page does not share it.

`src/web.ts` serves the public page through three `http::on-request` observers, each behind an allowlist:

| Route | Serves |
|---|---|
| `GET /<worker-name>` | `dist/web/index.html` |
| `GET /<worker-name>/:file` | only `app.js` and `styles.css` from `dist/web/`; `:file` can be `..`, hence the allowlist |
| `POST /<worker-name>/api/:fn` | only the functions the public page calls (template: `hello`): the request `body` is the payload, the answer is `{ status_code, headers: { "content-type": "application/json" }, body }`; any other `:fn` answers 404 |

- When the public page calls a new function, add it to the API allowlist in `src/web.ts` and to `test/web.test.ts`; a call outside the allowlist works from the ADE page and answers 404 on the public page. Admin-only functions (`set-greeting`, `info`) stay off the list; `test/web.test.ts` checks that `set-greeting` answers 404. Never replace the allowlist with a pass-through.
- Return text bodies (HTML, JS, CSS) as strings with an explicit `content-type`. Ship no binary assets (fonts, images) in the public page.
- The `http` port (3111 by default) has no authentication: everything on the allowlists is open to anything that can reach it. Never expose it through a public proxy or tunnel.

## Injectable UI builder

`ui/build.mjs` runs two builds; `pnpm build` and the dev loop run it from the package root.

1. **ADE assets.** `buildWorkerUi` from `@iii-dev/console-ui/build-worker-ui`, called with `scope: '<worker-name>'` (the `data-iii-ui` value, the first asset path segment), `root: import.meta.dirname` (`ui/`) and `outdir: '../dist/ui'`, writes `dist/ui/page.js` and `dist/ui/styles.css`. It (typed in `build-worker-ui.d.mts`) bundles `page.tsx` and `styles.css` with esbuild, keeps the six specifiers the Console's import map serves external — `react`, `react-dom`, `react-dom/client`, `react/jsx-runtime`, `@iii-dev/console-ui`, `lucide-react` — matched exactly so that `@iii-dev/console-ui/hooks` and `/format` still bundle, then checks every asset against the 8 MiB cap, refuses an unscoped stylesheet (`assertScoped`), fails on an unknown design token (`checkTokens`) and, on a non-watch build, runs the design-rule lint (`lintWorkerUi`) over `ui/`. The scaffold's `ui/build.mjs` passes `watch: false` and builds the public page first, so every build, the dev loop's included, is minified and checked, and a failed ADE check does not skip the public page. A failed check exits 1, which `pnpm build` and the dev loop surface. Never route the ADE assets through hand-rolled esbuild: a missing `react` external is a second React instance and "Invalid hook call"; a missing `@iii-dev/console-ui` external throws at once with the fix. Do not bundle an editor; use the Console's shared editor components in ADE-only surfaces. The remaining options (`entryPoints`, `keyframePrefixes`, `allowUnscopedSelectors`, `strictTokens`, `lint`, `plugins`, `extraExternal`, `define`) and the lint rules are in the designer's `console-injectable-ui` › The build.
2. **Public page.** esbuild bundles `web/main.tsx`, with React, `lucide-react` and App inside it, into `dist/web/app.js`; bundles `web/app.css` into `dist/web/styles.css`; and copies `web/index.html`. It is the only hand-rolled esbuild in the package, and bundling React is its point. `web/` sits outside `ui/` (`ui/tsconfig.json` still type-checks it), so the token check and the strict lint leave the page's own palette alone.

## Injectable UI entrypoint

`ui/page.tsx` is ordinary React that default-exports `setup(host)`. It registers the page with `host.pages.register({ id: '<page-id>', title: '<worker-title>', render })`, whose `render` returns `<WorkerPage host={host} onClose={onRequestClose} />`, and registers only the ADE-only surfaces that are implemented (`host.configForms.register`, `host.functionCalls.register`, `host.observerRenderers?.register`).

Set `configurationId: '<configuration-id>'` on the page registration only when `page.tsx` registers a config form; do not advertise settings without a corresponding interface. The template ships none: it has a configuration but no form, so change the greeting with `configuration::set { "id": "<worker-name>", "value": { "greeting": "Hi" } }`.

Read the package's public types before using any host API or component; never guess an export or prop. In this portable layout the types are at `node_modules/@iii-dev/console-ui/` — `index.d.ts`, plus `hooks.d.mts` and `format.d.mts` for the two subpaths that bundle into the asset (read them in full after `pnpm install`; `README.md` beside them documents `host.panels.open` and the chat integrations) — the `packages/console-ui/...` path some references mention does not exist here.

Icons are `lucide-react`: external in the ADE assets, where the Console's import map serves it, so an import adds no bundle bytes there; bundled into the public page. `import { Boxes } from 'lucide-react'` and render it at its default 16 px. Never hand-write `<svg>` glyphs (the build lint flags them) and never add another icon dependency. Where a prop asks for an icon, pass a Lucide component or element exactly as its type in `index.d.ts` declares.

The page body is the designer's work: `harness/ade-worker-design/console-injectable-ui` covers narrow panes, loading/error/empty states, renderer fallthrough, redaction, dirty state, live observers, accessibility, and real-Console testing; `harness/ade-worker-design/console-design` covers visual decisions.

Every selector in `ui/styles.css` must be scoped under `[data-iii-ui="<worker-name>"]`:

```css
[data-iii-ui="<worker-name>"] .<worker-name>-ui-main {
  min-width: 0;
  min-height: 0;
  overflow: auto;
}
```

Use shared tokens from the bundled references; their components belong only in ADE-only surfaces, the ADE page included, never in the public page's App (Public page and ADE admin page). Do not use Tailwind classes in injected markup, unscoped selectors, hard-coded theme colors, or decorative gradients; in ADE-only surfaces, use the shared components instead of a custom control system. Prefix custom keyframe names with the worker name because keyframes are global.

## Worker-side asset delivery

The scaffold's `src/index.ts` implements the injectable UI wire contract directly. Keep these rules when you edit it:

1. Build first, so `dist/ui/page.js` and `dist/ui/styles.css` exist. The manifest's `start` script does (`pnpm build && tsx src/index.ts`), so even a plain `compose::add` of the folder serves the page.
2. Read each file when `ui-content` is called, not at startup: a start without a build must still register everything, and a missing file throws an error that names `pnpm build` and the restart.
3. Register one content function, `<worker-name>::ui-content`, accepting `{ path }` and returning `{ content, content_type }`.
4. Observe `ade::ui::asset` once per asset, with the content function as the target:
   - `iii.observe({ function_id: 'ade::ui::asset', args: { kind: 'script', path: '<worker-name>/page.js' } }, '<worker-name>::ui-content')`;
   - `iii.observe({ function_id: 'ade::ui::asset', args: { kind: 'style', path: '<worker-name>/styles.css' } }, '<worker-name>::ui-content')`.
5. Keep the first path segment equal to `<worker-name>`; it defines the CSS scope.
6. Reject unknown asset paths.

Once each observer is active, the console calls the content function through it and serves the bytes. Observe over the worker's own connection: its observers are replayed after a reconnect and leave with the worker when it disconnects, and the console drops their assets.

During development, rebuilding `dist/ui` restarts the worker, which observes the same paths again; the next `ui-content` call reads the new bytes.

## Development loop

`pnpm dev` runs `scripts/dev.mjs`, and the scaffold's compose entry runs it as the container's `run` script (`node scripts/dev.mjs`, with `restart: on-failure`): it is what gives the worker hot reload under compose. Keep it working when you edit the package. Do not replace it with a single watcher; it must:

1. build the ADE assets and the public page once before starting anything else;
2. rebuild them on every `ui/` and `web/` edit with a one-shot `ui/build.mjs` (the same strict lint and minified production bundle as `pnpm build`; never a resident esbuild watcher, which polls and serves React's development build), so TSX and CSS changes rewrite `dist/`; a failed rebuild logs its error and the loop goes on, and a rebuild restarts the worker only when it changed `dist/ui`;
3. run the worker with reload, so a `src/` edit or a rebuilt `dist/ui` restarts it; watch each directory (not `recursive: true`, which on Linux goes silent after a save by rename);
4. terminate all children and exit with the worker's code when the worker exits on its own, so Compose sees the crash (not `node --watch`, which waits for the next edit while the container still looks running);
5. forward `SIGINT`/`SIGTERM` and escalate only after a short grace period.

This enables injectable UI hot development: an edit changes `dist/ui`, the worker restarts, reconnects and observes the same asset paths again with new content, and the Console hot-swaps the asset. The Console itself is not rebuilt. The public page shows a rebuild on its next browser reload.

## Worker manifest

The scaffold ships `iii.worker.yaml` at the worker root. Keep its `name` equal to `<worker-name>`; if you add a `dependencies:` block, list only what the worker uses.

## Declare the worker with `compose::add`

Never write the worker's entry into `worker-compose.yaml` by hand. A running daemon does not re-read the file on edit, and a hand-written entry makes it treat the worker as already declared: `compose::add` then answers `changed: false` and starts nothing. `compose::add` writes the entry itself, resolves it, and starts the container. The harness pins the call to its own daemon and compose file; do not pass `namespace` or `file`.

`compose::add` is asynchronous. Fetch its contract and `compose::operation`'s once (`engine::functions::info { "function_ids": ["compose::add", "compose::operation"] }`), then use this exact order:

1. Arm the wake, with a fresh operation id that starts with your session id (`<session-id>:add-<worker-name>`). Operation ids are global to Compose and never reusable, so a fixed name collides with an earlier session's operation:

   ```json
   harness::observe {
     "function_id": "compose::on-operation-progress",
     "filters": {
       "input.operation_id": { "$eq": "<session-id>:add-issue-board" },
       "input.terminal": { "$eq": true }
     },
     "once": true,
     "lifecycle": { "expires_in_ms": 600000 }
   }
   ```

   It returns `{ observer_id, once }`; keep the `observer_id`.

2. Read `compose::status` once. If it already lists a container named like the last segment of `compose.worker` (`<worker-name>`), stop and pick another name: `compose::add` replaces a container with the same key, so it would repoint the running one to the new folder. Otherwise build the `workers` list from the scaffold result and that read: the returned `compose` object, unchanged, then an entry for every `requires` container that `compose::status` does not list in `containers[].container`:

   ```text
   workers = [
     result.compose,
     ...result.requires.filter((name) => !declared.includes(name)),
     // http → { worker: "package://http", version: "latest", config_name: "http" }
   ]
   ```

   Declare them with the same operation id: `compose::add { "operation_id": "<session-id>:add-issue-board", "workers": <workers> }`. For `issue-board` in a stack without `http`, `workers` holds the container object followed by `{ "worker": "package://http", "version": "latest", "config_name": "http" }`.

   - `compose.worker` is already the absolute path of the scaffolded folder, which `compose::add` accepts; pass it unchanged. The container key is the folder's last segment, `<worker-name>`; `compose::status` shows it.
   - Add no `start_after` naming the console container (`ade` in the harness template). The worker runs without the console: its `ade::ui::asset` observers stay `pending` until the console registers that function, and become active again each time the console comes back. `start_after` would make the worker a dependent, and Compose stops a container's dependents when it exits, so a console exit would take the user's app offline.
   - Keep `compose.scripts` and `restart` as returned: `pre_run` installs the dependencies, `run` starts the dev loop (`node scripts/dev.mjs`), which gives the worker hot reload under compose, and `restart: on-failure` retries a crash.
   - Declare a missing `http` with that object, the same form the templates use, so it reads its `http` configuration. A `requires` container the stack already declares is not added again.
   - The response `{ operation_id, requested, status }` is an acceptance, not readiness.

3. Read `compose::operation { "operation_id": "<session-id>:add-issue-board" }` once. If `last_event.terminal` is true, remove the wake with `harness::unobserve { "id": "<observer_id>" }` and read the result; otherwise end the turn and let the terminal event wake you. Do not poll.

4. On the terminal event, confirm: `compose::status` shows the worker's container and every added `requires` container `ready`, `engine::workers::info { "name": "<worker-name>" }` lists its functions and the observers it created, and, before you replace the example, `<worker-name>::hello` answers a real call. On `failed`, `compose::logs { "container": "<container key>", "tail": 100 }` has the real error. `restart: on-failure` also retries a failed start, so a worker that never registers reaches `failed` only after its retries. Later, a crash ends the dev loop: Compose retries it (`restarting`), and each retry runs the files as they are then, so a fix saved meanwhile is picked up; after five quick failures it is `failed`: fix the code, then `compose::restart { "container": "<container key>" }`. The container runs the worker's own install and start scripts, so the first run installs dependencies and restarts once or twice while the dev loop writes `dist/`; that is expected.

A container that is already declared is left as it is by `compose::add`; if it is stopped, `compose::up { "container": "<container key>" }` starts it. A dependency added later is `pnpm add <package>` in the worker directory; the running loop picks it up on the next rebuild. Never restart the whole project: the harness is a container of it and goes down mid-turn.

## Implementation order

This is the sequence for a new worker. For an existing worker, apply only
affected steps and prerequisites; preserve its working scaffolding and
implemented UI. Reuse what the session already observed instead of repeating
discovery.

1. Resolve all project identifiers and paths; the worker name passes the name rule.
2. Use this file for backend/delivery work; fetch only references needed by
   the change. Preloaded bodies need no second fetch. UI implementation
   references are in `ade-worker-design`.
3. Inspect the destination project's Compose shape, existing workers and coding conventions; reuse a registered capability instead of scaffolding a duplicate.
4. Scaffold the package with `coder::scaffold-worker` (Scaffold a new worker).
5. The scaffold already added it to the stack: on its `compose::on-operation-progress` wake, confirm with `compose::status`, `engine::workers::info` and a real `<worker-name>::hello` call. Only when the result has a `start_error` or says it was not started, declare it through `compose::add` with its `requires` containers first (Scaffold a new worker, step 3).
6. Replace the example `hello` with the domain (keep `info`: the ADE page's **Open public page** reads it; keep or replace `set-greeting` with the domain's own admin writes): backend modules, functions with complete contracts, tests, and the API allowlist in `src/web.ts` for the functions the public page calls.
7. Add configuration integration if needed.
8. Leave `ui/WorkerPage.tsx` and `web/App.tsx` building against the new functions (`host.iii` and `client`). Then build the admin page and the other ADE-only surfaces from console components, and the public page with its own design in `web/app.css`, after the backend/delivery contracts are verified.
9. Verify both sides: backend checks static builds, runtime registration, asset delivery, the HTTP allowlists and hot reload; frontend checks real rendering in the ADE through the `browser` worker and at the public URL.

## Validation checklist

These checks cover the complete delivery: service, configuration, package
and asset checks, then rendered UI, interaction and accessibility checks. A
backend shell is not a finished screen. Report the evidence for the checks you
ran, and name the ones you did not run.
For corrections, rerun affected checks and dependencies, retaining earlier
evidence only while it remains applicable; broaden checks if impact is unclear.

- No `my-worker` token remains in any path or file of the worker, and no angle-bracket placeholder copied from this file remains.
- No example project name or repository-specific absolute path leaked into identifiers, scripts, or documentation.
- `pnpm install` succeeds and the lockfile resolves `@iii-dev/console-ui` from npm at `0.2.0`, not through `file:`, `link:`, or `workspace:`.
- `pnpm typecheck`, `pnpm test`, and `pnpm build` pass.
- `pnpm dev` builds all outputs before starting watchers, shuts down cleanly, and exits when the worker crashes.
- The worker appears in the engine with every intended function, and `engine::workers::info` lists its asset observers.
- The worker's event function is registered `private: true`, returns the event it is called with, and delivers to an observer after a real mutation; that observer's `metadata` reaches its target as the handler's second argument.
- Every public function exposes accurate descriptions and request/response schemas.
- Configuration registration, read, update, and reload behavior work without erasing existing or unknown values.
- `dist/ui/page.js` and `dist/ui/styles.css` are non-empty; `react`, `@iii-dev/console-ui` and `lucide-react` stay bare imports (release builds are minified, so expect `from"react"`), and the build's scope, token and lint checks passed.
- `dist/web/index.html`, `dist/web/app.js` and `dist/web/styles.css` exist, and `app.js` carries React inside it (no bare `react` import).
- `web/App.tsx` imports nothing from `@iii-dev/console-ui` except through `import type`; `ui/WorkerPage.tsx` is built from its components (`PageShell`, `PageHeader` with the iii `Wordmark` as icon), saves the greeting through `<worker-name>::set-greeting` and shows **Open public page** from `<worker-name>::info`'s `web_url`, else `web_path` on the console's host at the `http::status` port.
- `GET <url>/<worker-name>`, with the `url` from `http::status` (`http://127.0.0.1:3111` by default), renders the public page (`App`), in light and dark color schemes and at phone width, and its calls succeed; `GET /<worker-name>/<any other file>` and `POST /<worker-name>/api/<a function outside the allowlist>` answer 404.
- The UI content function serves both registered paths and rejects unknown ones.
- Asset paths, CSS scope, HTTP prefix, worker name, function prefix, and configuration id are internally consistent.
- The Console manifest (`GET <console url>/ui` with the `url` from `ade::status`, or `ade::ui-manifest`) contains both assets, reports no CSS warnings, and changes hashes after a UI edit.
- A real harness call to the worker (e.g. the agent fetching one record) renders through the worker's chat renderer — the result arrives as a `{ content, details }` envelope and must be unwrapped (see the designer's `console-injectable-ui`); confirm a `[data-iii-ui="<worker-name>"]` wrapper exists inside the chat DOM.
- When the domain has live data (ADE-only surfaces): live updates reach an open ADE surface without a reload: mutate through a function from outside the UI and watch it change.
- When the domain has records (ADE-only surfaces): a record opens as its own pane in the same workspace tab through `host.panels.open`. In every case the page adapts when the tab splits (narrow mode).
- The real Console renders the page (alone at `#/worker/<worker-name>[/<page-id>]` for screenshots, and inside the workspace) in narrow and wide panes, light and dark themes, with keyboard navigation, visible focus, stable async states, and no browser-console errors.
- Reconnects and repeated UI edits do not accumulate duplicate functions, observers, pages, renderers, or forms.
- The worker was declared through `compose::add`, never by editing `worker-compose.yaml`; `compose::status` shows it and every `requires` container `ready`, and its entry is the scaffold's `compose` object, with no `start_after` naming the console container.
