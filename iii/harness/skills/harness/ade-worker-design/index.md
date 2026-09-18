---
name: ade-worker-design
description: >-
  Design and build the UI an iii worker injects into the ADE console — pages,
  function and trigger-activity renderers, configuration forms and scoped
  stylesheets — against the console's host contract, its design system and the
  record-shaped interaction patterns. Read it before adding or changing any
  worker console UI.
---

# ade-worker-design

The ADE console is the host every worker can inject UI into at runtime: a
worker registers a `console:script` and a `console:style` asset, every open
tab imports the module, calls its `setup(host)`, and hot-reloads it on
re-registration. No console rebuild, no iframe. This skill is the designer's
half of building such a worker: what the host accepts, how the console looks
and behaves, and which interaction pattern fits which kind of data. The
worker's service half — package shape, functions, configuration, delivery,
compose wiring — is the `iii-node` skill and belongs to the Backend Engineer.

## Choose the reference for your role

Product planning uses `harness/ade-worker-design/planning`; architecture
uses `harness/iii-node/architecture`. Those roles do not load the UI manuals
below unless a specific unresolved decision requires a scoped reference check.

For UI implementation, use the references below in this order of authority.
Bodies already preloaded are already read; do not fetch them again. When
looking up a detail, inspect the relevant section instead of rereading all
three documents:

- `console-injectable-ui` — the authoring contract: the wire contract and
  asset rules, the `setup(host)` slots (pages, panels, function-trigger and
  trigger-activity renderers, configuration forms, provider forms, chat
  slots, overlays, palette), `host.iii` for live data, the shared build
  driver with its six externals and design lint, the bundling `/hooks` and
  `/format` subpaths, `lucide-react` icons, scoping, hot reload, debugging,
  behaviour across widths, the configuration-form grammar, testing (a page
  alone at `#/worker/<scope>[/<page-id>]`) and the delivery checks.
- `console-design` — the iii Schematic design system: surface ramp, tokens,
  typography, radius, motion, the one Numbers table, every shared component
  with its do/don't, hooks and formatters, the UX patterns table and the
  do/don't list every injected page must follow.
- `patterns` — recipes for record-shaped UIs: a board with lanes and drag and
  drop, a record screen that opens as its own pane, activity timelines with
  threaded comments, creation dialogs, chat cards for agent calls, settings
  forms and live updates. Pick the pattern before writing JSX.

Fetch any of them with `directory::skills::get { "id": "harness/ade-worker-design/<name>" }`.

## Boundaries

- The console renders; the worker owns the data. Injected UI acts only by
  calling its own worker's functions over `host.iii`, and configuration values
  live in the `configuration` worker (`harness/iii-node/configuration`).
- Components, props, slots and host methods come from
  `@iii-dev/console-ui`'s `index.d.ts` (hooks from `hooks.d.mts`, formatters
  from `format.d.mts`, icons from `lucide-react`), never from memory. If it
  is not declared there, it does not exist.
- Every rule in the worker stylesheet is scoped under
  `[data-iii-ui="<worker>"]`; an unscoped rule restyles the whole console.
  The build driver refuses one and the manifest reports leftovers as
  `warnings`.
- Asset triggers go through the SDK Message path, never the durable
  `engine::register_trigger`, and never `console:assets`.
- New surfaces must be seen in the running console at phone, narrow-split
  and wide widths, in both themes, with the manifest free of warnings: a
  page alone at `#/worker/<scope>[/<page-id>]` for screenshots and
  drive-through, the full console for chat slots and the palette. On
  corrections, recheck affected states and dependencies; reuse earlier
  observations only while they still apply. A build alone is not evidence
  that the screen works.
