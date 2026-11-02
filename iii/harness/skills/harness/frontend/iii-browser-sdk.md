---
title: iii-browser-sdk
description: Make a browser app a first-class iii worker with iii-browser-sdk — registerWorker, registerFunction, call, observe, engine state, and streaming channels, wired into React and Vite.
type: how-to
---

# iii-browser-sdk

`iii-browser-sdk` turns the frontend into an iii worker: one WebSocket to the engine instead
of many HTTP round-trips, backend workers pushing into the UI with `call()`, and the same
primitives used server-side (`registerFunction`, `call`, `observe`). No Node.js
dependencies, no OpenTelemetry — it runs on native `WebSocket`.

Docs <https://iii.dev/docs/tutorials/linkly/frontend> ·
API reference <https://iii.dev/docs/reference/sdk-browser> ·
npm <https://www.npmjs.com/package/iii-browser-sdk>

**The installed types are the contract.** Before writing SDK code, read the project's
`node_modules/iii-browser-sdk/dist/index.d.mts` (plus `state.d.mts`, `helpers.d.mts`), or the
published file at `https://cdn.jsdelivr.net/npm/iii-browser-sdk@<version>/dist/index.d.mts`.
Never write these calls from memory: the export names and the `InitOptions` keys are the
exact surface, and the internal type chunk is content-hashed, so re-read it per version.

## Install, and the only entry point that matters

```bash
pnpm add iii-browser-sdk
```

```ts
import { registerWorker } from 'iii-browser-sdk'

const iii = registerWorker(import.meta.env.VITE_III_WS_URL) // the public RBAC listener, e.g. rbac-proxy: ws://localhost:49200 by default
```

`registerWorker(address, options?)` is the sole top-level function; everything else hangs off
the returned `ISdk` — `registerFunction`, `call`, `observe`, the observer hooks
(`onObserverAdded`, `onObserverRemoved`, `onObserverMatch`, `onObserverDeliver`),
`addConnectionStateListener`, `getFatalError`, `shutdown`. Since 0.26 there is no
`registerTrigger` or `registerTriggerType`; `trigger` and `TriggerAction` remain only as
deprecated aliases of `call` and `CallAction`. Do not destructure
these as top-level imports; they are not exported that way.

`InitOptions`: `workerName`, `namespace`, `invocationTimeoutMs` (default 30000),
`reconnectionConfig`, `headers` (ignored — see auth). The browser has no `process.env`, so
`namespace` has no environment fallback: pass it explicitly when you need one.

## Registering a function the backend can call

```ts
const ref = iii.registerFunction(
  'ui::show-notification',
  async (data: { title: string; body: string }) => {
    toast.push(data.title, data.body)
    return { displayed: true }
  },
  { description: 'Shows a toast in the open tab' },
)
// later
ref.unregister()
```

- The handler is `async (payload) => result` and runs **in the browser tab**.
- Pass a `description` (plus `request_format` / `response_format` when callers need the
  contract) — that is what `engine::functions::info` shows.
- Return JSON-serializable data; a thrown error surfaces as the caller's error.
- A backend worker reaches it by id: `iii.call({ function_id: 'ui::show-notification', payload })`.

## Calling backend functions

```ts
const users = await iii.call<{ limit: number }, User[]>({
  function_id: 'api::get::users',
  payload: { limit: 20 },
  timeoutMs: 5000,
})
```

Three routing modes — choose deliberately:

| Mode | Call | Use when |
| --- | --- | --- |
| await (default) | `await iii.call({ function_id, payload })` | you need the result |
| fire-and-forget | `action: CallAction.Void()` | telemetry, non-essential side effects |
| enqueue | `action: CallAction.Enqueue({ queue })` | long work; resolves to `{ messageReceiptId }` |

`namespace` on the request routes the invocation elsewhere; omit it to stay in your own.

## Receiving live pushes (there is no polling story)

The engine can invoke a function registered in the tab at any time:

```ts
iii.registerFunction('ui::update-dashboard', async (m: Metrics) => {
  store.setMetrics(m)
  return null
})
```

That is the whole real-time design: a backend worker calls
`call({ function_id: 'ui::update-dashboard', payload })` and the open tab updates. Do not
add polling, SSE, or a second socket alongside it.

## Observers in the browser

```ts
const observer = iii.observe(
  {
    function_id: 'state::on-changed',
    filters: { 'input.scope': { $eq: 'orders' } },
    deliver: 'input', // the target receives the change, not the Observed envelope
  },
  'ui::refresh', // a function this tab registered
)
// later
await observer.dispose()
```

The target is a function this tab registered. The source resolves in this worker's namespace
unless it sets `namespace`. Hosting an observable function from a browser is rarely right: it
only makes sense when the browser itself is the event source. The RBAC listener decides what a
browser session may observe: its grants must cover both the observed function and the target.

### Live data from a worker-owned change function

When the tab shows records a backend worker owns and must stay current, the worker owns both
the data and an observable function it calls after each committed change (`harness/iii-node/index`
› Live updates). The tab observes that function with a handler of its own, reads the current
state with the worker's query, and reads again whenever a change arrives or the connection comes
back. An observer is a notification, not storage: nothing missed while disconnected is replayed,
so the query is the source of truth.

```tsx
function useLiveOrders() {
  const iii = useIii()
  const queryClient = useQueryClient()
  const orders = useQuery({
    queryKey: ['orders'],
    queryFn: () => iii.call<{ limit: number }, Order[]>({
      function_id: 'orders::list',
      payload: { limit: 100 },
    }),
  })
  useEffect(() => {
    // A fresh id per mount: only one live worker may own a function id in a namespace,
    // and a remount (StrictMode, HMR) must not reuse the id its cleanup is unregistering.
    const handlerId = `ui::orders-changed::${crypto.randomUUID()}`
    const refetch = () => queryClient.invalidateQueries({ queryKey: ['orders'] })
    const fn = iii.registerFunction(handlerId, async () => {
      refetch()
      return null
    })
    const observer = iii.observe(
      { function_id: 'orders::on-changed', deliver: 'input' }, // the orders worker's change function
      handlerId,
    )
    // Fires now with the current state, then on every transition: the read after observing
    // covers a change that landed before the observer, and a reconnect re-reads.
    const off = iii.addConnectionStateListener((state) => {
      if (state === 'connected') refetch()
    })
    return () => {
      off()
      void observer.dispose().catch(() => undefined)
      fn.unregister()
    }
  }, [iii, queryClient])
  return orders
}
```

- Payloads that carry an id and a revision (or the whole record) let the tab skip a
  notification it already has, or upsert without a round trip.
- The RBAC auth function grants the session `orders::on-changed`, the handler ids and the
  query; a per-tab `namespace` is the other way to keep two tabs' handlers apart.

## State, helpers, channels (subpath exports)

- `iii-browser-sdk/state` — the engine's state worker, typed: `get<T>`/`set`/`delete`/`list`/
  `update`, plus `StateEventType.Created|Updated|Deleted` for the change events
  `state::on-changed` is called with. Use `update` with ordered `ops` when you need an atomic edit instead of a
  read-modify-write race.
- `iii-browser-sdk/helpers` — `createChannel(iii, bufferSize?)` returns a `Channel` with
  `writer` / `reader` and *serializable* `writerRef` / `readerRef`, so a ref can be handed to
  a backend worker and the bytes stream either direction; `isChannelRef` and
  `extractChannelRefs` (recursive, returns `[path, ref]` tuples) complete the set. The module
  still exports `createStream`, deprecated together with `iii-stream`: never use it for live
  data. Observe the owning worker's change function instead (above, and the "Migrate from iii-stream
  and pubsub" guide).
- `ChannelWriter.sendMessage` / `sendBinary` / `close`; `ChannelReader.onMessage` /
  `onBinary` / `readAll`.
- Some releases publish `iii-browser-sdk/stream` as an empty module with types only. Read the
  installed `dist/` for the version in front of you instead of assuming.

## Connection, auth, and the failure modes that cost an afternoon

- **Auth is RBAC at the listener, not headers.** A browser cannot set headers on a WebSocket
  handshake, so `headers` is ignored: credentials ride as **query parameters or cookies** and
  are judged by the RBAC *auth function* on the upgrade request (`{ headers, query_params,
  ip_address }` in, `AuthResult` out, scoping namespaces, allowed/forbidden function ids; observing
  needs both the observed function and the target). The engine-owned listener must be a **public, RBAC-protected
  instance** (e.g. `iii-worker-manager#browser`, or the `rbac-proxy` worker in front of the
  private one); the private listener must never face
  untrusted browser clients.
- **Never pin `workerName` across tabs.** The default `browser:<random>` is deliberate: the
  engine allows one live worker per name per namespace, so two tabs sharing a fixed name evict
  each other. Pin it only for a deliberately single-tab app that needs a stable identity.
- **Surface connection state.** `addConnectionStateListener(handler)` fires immediately with
  the current state and then on every transition (`disconnected`, `connecting`, `connected`,
  `reconnecting`, `failed`); it returns an unsubscribe function. Bind the reconnecting banner
  and stale-data treatment to it. Reconnection is exponential backoff with jitter — tune
  `reconnectionConfig` (`initialDelayMs` 1000, `maxDelayMs` 30000, `backoffMultiplier` 2,
  `jitterFactor` 0.3, `maxRetries` -1) rather than writing your own retry loop.
- **Fatal rejections are terminal.** A name or namespace collision raises
  `RegistrationRejectedError` (`code`, `namespace`, `worker_name`, `function_id`,
  `owner_worker_id`), is thrown into every pending invocation, and closes the connection for
  good; `iii.getFatalError()` returns it while healthy returns `undefined`. Show it; do not
  retry blindly.
- **`shutdown()`** on teardown, in tests, and before re-registering during a hot reload.

## React integration

One worker per app, created outside React and handed down. Never one per component, and never
inside a render body — StrictMode double-invokes render, so a socket built there leaks.

```ts
// src/iii/client.ts
import { registerWorker, type ISdk } from 'iii-browser-sdk'

let client: ISdk | undefined
export function getIii(): ISdk {
  return (client ??= registerWorker(import.meta.env.VITE_III_WS_URL))
}
```

```tsx
// src/iii/IiiProvider.tsx
export const useIii = () => {
  const iii = useContext(IiiContext)
  if (!iii) throw new Error('useIii must be used inside <IiiProvider>')
  return iii
}

export function IiiProvider({ children }: { children: ReactNode }) {
  const iii = getIii()
  const [state, setState] = useState<IIIConnectionState>('connecting')
  useEffect(() => iii.addConnectionStateListener(setState), [iii])
  const fatal = iii.getFatalError()
  if (fatal) return <FatalBanner error={fatal} />
  return (
    <IiiContext.Provider value={iii}>
      <ReconnectBanner state={state} />
      {children}
    </IiiContext.Provider>
  )
}
```

Rules that keep this honest:

- **Register handlers in an effect; unregister in its cleanup.** `registerFunction` returns a
  `FunctionRef` with `unregister()`. Skip it and an unmount or HMR leaves a stale handler
  answering backend calls in a dead tab.
- **Function ids that other code calls must be stable and addressable.** Name them for what
  they do (`ui::notification`), never after a component instance. Only one live worker may own
  a function id in a namespace: the engine rejects a second tab that registers the same id
  there, it does not load-balance between them. Use a `state` key or a channel when you need
  one specific tab, and give a handler that only a trigger binding reaches a unique id created
  where it registers, as `useLiveOrders` does.
- **`trigger()` is an imperative async call, not a render input.** Route it through a query or
  mutation layer (`queryFn: () => iii.call({ ... })`) so caching, retries, and loading
  states live in one place. Never call it during render.
- **Server state is not UI state.** Engine state and trigger results belong in the cache, not
  mirrored into `useState`.
- **Errors are values.** A rejected `trigger` should reach an error boundary or an inline
  state, not be swallowed in a `.catch(() => {})`.

## Vite

```bash
# .env.local: the public RBAC listener, e.g. rbac-proxy (the `port` rbac-proxy::status answers, 49200 by default)
VITE_III_WS_URL=ws://localhost:<port rbac-proxy::status answers>
```

- Never the `http` worker's port (3111 by default), which serves HTTP routes and no worker
  protocol, nor the engine's private port (49134 by default; see auth above).
- Only `VITE_`-prefixed variables are exposed; read them with `import.meta.env.*`.
- The package is ESM with `exports` for `.`, `./helpers`, `./state`, and `./stream`;
  `import` and `require` both resolve, and no polyfill is needed on native `WebSocket`.
- If a dev-server reload ever races the first registration (symptoms: two clients, two
  sockets, a duplicated module), add `optimizeDeps: { include: ['iii-browser-sdk'] }` and clear
  `node_modules/.vite` once.
- A production build pointing at `ws://localhost` is a silent failure that only shows up in the
  connection banner. Keep the URL in the environment, never committed to source.

## Checklist before claiming it works

1. `engine::functions::list { prefix: "ui::" }` lists the functions the tab registered.
2. `engine::functions::info { function_id: "ui::…" }` returns the description you passed.
3. A real backend `trigger` of that id changes the rendered UI — observed in a live
   `browser::sessions::start` tab, not assumed from the code.
4. Stopping the engine flips the UI to `reconnecting`; restarting it restores registration with
   no page reload.
5. No stale handler survives an unmount or HMR (the `registerFunction` cleanup is present).
6. A name or namespace collision is surfaced through `getFatalError()`, not swallowed.
