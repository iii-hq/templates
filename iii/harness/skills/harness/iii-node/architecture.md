---
name: iii-worker-architecture
description: >-
  Define a portable Node worker's identities, runtime contracts, data ownership,
  console integration and engineer boundaries without loading scaffold code.
---

# Architecting an ADE worker

Use this contract for architecture decisions. The Backend Engineer uses
`harness/iii-node/index` for scaffold code; the Frontend Engineer uses
`harness/ade-worker-design/index` for UI implementation. Load a detailed
reference only to resolve a concrete question, not to prepare their work.

## Identity and boundaries

- Choose one stable lowercase worker name. Derive the function prefix,
  asset path prefix, CSS scope and manifest name from it. Choose a globally
  distinct page id, a configuration id (normally the worker name), and an
  upper-snake-case environment prefix. Record actual paths and identifiers.
- Functions are the public contract: `<worker>::<resource>::<action>`, one
  action per function, with description, request/response schemas and typed
  failure shapes. Check registered capabilities before adding a duplicate.
- Name affected callers and the compatibility plan when changing a schema.
  Bindings and retries require idempotency keys where work can repeat.
- Give each fact one home: engine state for small watched values, database
  for records, configuration for operator settings. Name persistence,
  validation and migration requirements without writing their implementation.
- Specify each required event's type, filter/config schema, emission point
  and payload. Emit after persistence; include the record needed for upsert.
  Preserve subscription metadata as a separate channel. Consumers react to
  events instead of polling. Name namespace boundaries; engine-hosted
  configuration and state live in `default` under a namespaced Compose project.

## Delivery contract

One Node package owns backend and UI. Backend source is under `src/`, UI
under `ui/`, generated outputs under `dist/`. UI calls functions through
`host.iii`; it never imports backend modules or reads backend files.

The Backend Engineer owns package/dependency files, both TypeScript configs,
`pnpm-workspace.yaml`, `scripts/dev.mjs`, `ui/build.mjs`, initial UI shell,
`iii.worker.yaml`, the asset content function and Compose declaration.
`pnpm dev` builds, type-checks and watches both halves; a UI edit changes
asset hashes and hot-reloads the open console. Declare through `compose::add`
under a wake, never by editing `worker-compose.yaml` or restarting the stack.

UI assets use SDK Message-path `console:script` and `console:style` triggers,
not durable engine registrations. Both asset paths start with the worker
name; every stylesheet selector is scoped under `[data-iii-ui="<worker>"]`.
React, `@iii-dev/console-ui` and `lucide-react` remain external; `ui/build.mjs`
is the shared `buildWorkerUi` driver, not hand-rolled esbuild. Installed public
types are the authority for host methods and components; portable workers use
the public npm package (`@iii-dev/console-ui@0.2.0` or later) rather than
monorepo links.

The Frontend Engineer owns `ui/page.tsx`, `ui/styles.css` and `ui/src/**`:
pages, renderers and configuration forms against registered contracts.
Package, build or API gaps go back to the Backend Engineer. Existing working
scaffolding is reused; skeleton files are created only for a new package.

## Work and verification ownership

New worker: backend and delivery first, frontend after their contracts pass.
Existing worker: dispatch only the owners of affected files/contracts.
Check prerequisites before a UI-only dispatch; a missing API or broken build
is backend work even when the user asked for a visual change.

Record child checks and parent checks separately in the architecture:
engineers prove their implementation, the Tech Lead independently exercises
affected runtime contracts and the UI/service boundary, and the Builder
observes user acceptance criteria. Name evidence paths and record the tested
version/hash or runtime time inside those artifacts. Invalidate earlier
results when their code, contracts or runtime change.
