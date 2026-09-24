---
name: ade-solo-backend
type: how-to
description: >-
  Build the service side of an ADE worker to the spec's architecture in a
  single-agent build (Node package, granular functions, own trigger type,
  configuration, UI asset delivery and the compose declaration), each piece
  verified with a real call.
---

# Backend (Backend Engineer hat)

You build the service to `## Architecture`; you do not redesign it. A misfit
goes back to the Architecture section first, with the reason in `Notes`.

## Knowledge for this phase

`harness/iii-node/index` (about 37 KB) is the scaffold authority and
outranks anything you remember about iii. List its headings, then read the
sections the work needs, each when you reach the step it shapes:

| Work | Read |
| --- | --- |
| New worker | Choose project identifiers once; Canonical project shape; Root `package.json`; TypeScript configuration; Node SDK rules; Injectable UI builder; Injectable UI entrypoint; Worker-side asset delivery; Development loop; Worker manifest; Declare the worker with `compose::add`; Validation checklist |
| Workspace already ships the worker's package and compose entry | Node SDK rules (with Namespaces); Worker-side asset delivery; skip the scaffold, TypeScript, pnpm and `compose::add` sections |
| New or changed function | Node SDK rules (Namespaces when crossing one or when you start the worker yourself) |
| Own trigger type, live updates | Live updates (own trigger type) |
| Operator settings | Configuration, plus `harness/iii-node/configuration` whole (about 6 KB) |
| Container not starting or not declared | Declare the worker with `compose::add` |

Its Required references, Implementation order and Validation checklist also
describe the Frontend Engineer's half. Skip the hand-off steps, and leave
the UI manuals for the Frontend phase.

## First move

Start from `Project context` and `## Architecture`. Read only affected
source, package and compose entries. Reuse first: search the registered
functions and `directory::registry::workers::list` before writing a new
worker. When you first need them, fetch in one batch the contracts you do
not already hold among `compose::add`, `compose::operation`,
`compose::status`, `compose::logs`, `engine::register_trigger`,
`engine::workers::info`, `console::ui-manifest` and `browser::fetch`.

## Boilerplate

First decide which of the two shapes the workspace is in, and record it in
`Project context`.

### A new worker

Scaffold one Node package exactly as `iii-node` prescribes before domain
code: `package.json` with `build`, `build:ui`, `typecheck`, `test`, `start`
and `dev`; `pnpm-workspace.yaml` with `allowBuilds`; `tsconfig.json` and
`ui/tsconfig.json`; `scripts/dev.mjs`; `ui/build.mjs` calling
`buildWorkerUi`; the asset content function and the two Message-path asset
triggers; `iii.worker.yaml`. Write only a minimal `ui/page.tsx` and
`ui/styles.css` shell, enough to prove build and delivery; the real screen
belongs to the Frontend phase.

Declare the worker through `compose::add` (a container object with
`scripts: { run: "pnpm dev" }` and `start_after` the console container)
under a `compose-operation` wake, exactly as the manual's section says.
Never edit `worker-compose.yaml`: a hand-written entry makes the daemon
answer `changed: false` and start nothing.

### A workspace that already ships a scaffold

When the worker's `package.json` already exists and `worker-compose.yaml`
already declares it (an entry the harness or the template owns), keep that
shape: no `compose::add`, no pnpm or TypeScript migration, no
`scripts/dev.mjs`. Use its package manager (for example npm), its entry
file (for example `src/index.mjs`) and its scripts; add only what the
architecture needs. Tests run with an explicit glob,
`node --test test/*.test.mjs`: Node 22+ fails with `MODULE_NOT_FOUND` on a
bare directory such as `node --test test/`.

For an existing worker in either shape, reuse its working scaffolding,
change only affected prerequisites, and never replace an implemented UI
with a shell.

## Doctrine

- **The contract is the product.** Every function has a `description`,
  `request_format` and `response_format`, named
  `<worker>::<resource>::<action>`.
- **Engine fields are not caller fields.** The engine adds `_`-prefixed
  keys such as `_caller_worker_id` to every payload. A handler that rejects
  unknown fields must ignore keys starting with `_`, or every real call
  fails with `Unexpected field(s): _caller_worker_id`.
- **Granular.** One action per function, small input, small output.
- **Reactive, never polling.** The own trigger type emits the whole record
  after every persisted mutation and forwards subscription metadata. The
  worker's own reactions are bindings armed before the producer starts.
- **Never block on long work.** Slow or externally bounded work goes
  through the durable queue and publishes its outcome.
- **Idempotency.** Anything a trigger, retry or redelivery can run twice is
  keyed; name the key.
- **Configuration is data.** Registered through the `configuration` worker
  with a schema and public defaults; never a hardcoded environment value,
  never a secret in a default.
- **Errors are contract.** A typed failure the caller can act on; never an
  error swallowed into a success-shaped response.
- **Migrations are forward-only**, with a backfill and a rollback note,
  never a drop.

## Verify with a call (the gate)

A new worker runs every check. A change runs the affected checks and their
dependencies, keeping earlier evidence only while its code, contracts and
runtime still apply; broaden when the impact is uncertain.

**Where the worker runs.** Check against the copy compose runs
(`compose::status`, `compose::logs`). Start one yourself only when compose
does not run it, never beside the compose copy. A process you start does
not inherit `III_NAMESPACE`, lands in `default`, and the harness and the
console cannot reach its functions (`function_not_found`). Start it with
`III_NAMESPACE=<project namespace>` (the namespace the project's workers
show in `engine::functions::list` results) and stop it before the turn
ends.

1. `engine::functions::list { "prefix": "<worker>::" }`: the ids appeared,
   in the project namespace.
2. `engine::functions::info`: schema, description and owning worker match
   the architecture.
3. Call each function with a real payload and read the response body. For
   an HTTP route use `browser::fetch`, never `curl`.
4. A trigger type fires: produce the mutation and observe the event.
5. Failure paths: missing field, unknown id. An unhelpful error is a
   contract fix.
6. `console::ui-manifest` lists the asset paths with hashes and an empty
   `warnings` array. Asset rows carry `worker: null`: select them by
   `path` (`<scope>/page.js`, `<scope>/styles.css`), never by `worker`, or
   you get `[]`. When `fp::pipe` is registered one call does it:
   `console::ui-manifest` → `fp::get { "path": "/assets" }` →
   `fp::groupBy { "path": "/path" }` →
   `fp::pick { "paths": ["<scope>/page.js", "<scope>/styles.css"] }`, then
   read each entry's `hash` and `warnings`.
7. Hot reload under the dev script (`pnpm dev` in a new worker, the
   workspace's own script otherwise): touch `ui/styles.css` and see the
   style hash change; touch a `src/` file and see the worker reconnect with
   its functions still registered.
8. Unit tests for pure logic, an integration test against the real engine.
   A test that mocks the thing under test proves nothing.

Write the trimmed calls and responses to the evidence file, set
`Backend: done <when> · harness/ade-solo/backend` in `Progress`, and fetch
the next phase's playbook.
