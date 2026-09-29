---
name: ade-solo-frontend
type: how-to
description: >-
  Build the UI an ADE worker injects into the console in a single-agent
  build, against @iii-dev/console-ui and the iii Schematic design system,
  reading only the manual sections the screen needs, and verify it in the
  running console.
---

# Frontend (Frontend Engineer hat)

You build what lives in `ui/page.tsx`, `ui/styles.css` and `ui/src/**`,
against functions the worker already registers. In this phase you do not
change functions, trigger types, the configuration schema, asset delivery or
the package and build files. A gap there sends you back to the Backend
phase, and to `## Architecture` first when a contract changes.

## Knowledge for this phase

Authority, in order: `harness/ade-worker-design/console-injectable-ui` (the
contract, about 50 KB) › `harness/ade-worker-design/console-design` (visual
rules and every number, about 27 KB) › `harness/ade-worker-design/patterns`
(recipes, about 15 KB) › `harness/frontend/react`, `web-accessibility`,
`web-performance`. List headings and read by need:

| Need | Read |
| --- | --- |
| Any page | console-injectable-ui: How it works; Project layout; Authoring workflow; Archetypes; 1. The script asset (with Slots); 2. The style asset |
| Phone and narrow panes | console-injectable-ui: Behaviour across widths, only the subsections in play |
| Shared components, tokens | console-design: Numbers; the Shared components subsections for components you use; Do / Don't |
| The chosen archetype | patterns: that archetype's section, plus 8. Live updates |
| Configuration form | console-injectable-ui: Configuration forms; patterns: 7. Settings form |
| Function or trigger renderer | console-injectable-ui: Slots; Trigger renderers |
| Build or lint failure | console-injectable-ui: 3. The build; Lint |
| Something renders wrong | console-injectable-ui: Debugging |
| Verification | console-injectable-ui: Testing; Interaction matrix; Definition of done |
| React, accessibility or performance detail | the matching `harness/frontend/<name>`, only for a concrete question |

## The API: `@iii-dev/console-ui`

The package is type-only at build time; the console's import map serves the
runtime. `node_modules/@iii-dev/console-ui/index.d.ts`, with `hooks.d.mts`
and `format.d.mts` beside it, is the authority, or
<https://unpkg.com/@iii-dev/console-ui@0.2.0/index.d.ts> when it is not
installed. Do not read it whole: search it for the components, hooks and
host methods you plan to use (`include_globs: ["**/index.d.ts"]`; globs
match relative to the search `path`, so a bare file name finds nothing) and
read those declarations. If it is not declared there, it does not exist.
Never a component, prop or export from memory.

## First move

1. The Console surface in `## Architecture`, then
   `engine::functions::list { "prefix": "<worker>::" }` and
   `engine::functions::info` for each id the screen calls. A missing
   function or broken delivery is Backend work, even in a UI-only demand.
2. The affected `ui/` files. Preserve an existing UI; replace only a
   backend shell.
3. Fetch in one batch the contracts you do not already hold among
   `console::ui-manifest`, `browser::fetch`, `browser::sessions::start`,
   `browser::sessions::stop`, `browser::sessions::list`,
   `browser::navigate`, `browser::snapshot`, `browser::act`,
   `browser::resize`, `browser::screenshot`, `browser::console::read`,
   `browser::network::read` and, only when a check needs the full console,
   `console::workspace::open` and `console::workspace::close`.
4. The ADE URL: profile › The ADE URL (`http://127.0.0.1:3113` unless
   `Project context` names another). Navigate to it; no lookup first.
5. Confirm the worker runs under its dev script (`pnpm dev` in a new
   worker): every save under `ui/` rebuilds, re-registers the assets and
   hot-swaps open tabs.

## Doctrine (non-negotiable)

- **One archetype per page.** Derive sidebar counts, breakpoints and
  controls from the worker's own content, never from another page.
- **Surfaces, not borders.** Strokes only for focus, the workspace edge and
  an optional neutral selection edge. Selection is neutral in both themes;
  accent is rationed to primary actions, form focus, live activity and
  semantic data.
- **One 6 px radius.** Sans for human-facing text in natural case; mono only
  for ids, paths, values, payloads, code and tabular data. `lucide-react`
  icons at 16 px, never inline `<svg>`.
- **Shared primitives first.** `PageShell` + `PageHeader` wrap every page;
  `PageSidebar` owns collapse, resize and narrow mode; `ConfirmDialog`,
  never `window.confirm`. Configuration forms are `SettingsSection` →
  `SettingsList` → `SettingsField`/`SettingsRow`, `SettingsDeck` for
  collections, `RawValueInput` for `${ENV}` templates; never a raw JSON
  textarea, never a private copy of a shared control.
- **Configuration is host-owned.** Every configurable page sets
  `configurationId`; every configuration entry registers a `host.configForms`
  form; the host owns dirty tracking, validation, save and reset.
- **Responsive to the pane.** Measure the container, drill in one pane at a
  time with a labelled Back when content stops fitting, 44 px targets when
  narrow, no horizontal page scroll.
- **Live, never polled.** The worker's own trigger type over `host.iii`, one
  binding per tab, registered on the first subscriber and torn down on the
  last. The engine is never mocked in the page.
- **Accessible by default.** Semantic elements before ARIA, real buttons,
  visible focus, labels, focus moved on navigation and restored on close.
- **Five states** in the space the content will occupy: loading, empty,
  error, success, overflow.
- **Scoped styles.** Every rule under `[data-iii-ui="<worker>"]`, tokens
  only, prefixed keyframes, reduced motion honoured. No Tailwind, `:root`,
  `html`, `body`, bare elements or `@font-face`.
- **The build is `buildWorkerUi`.** Six externals (`react`, `react-dom`,
  `react-dom/client`, `react/jsx-runtime`, `@iii-dev/console-ui`,
  `lucide-react`); `/hooks` and `/format` bundle in. A lint error is a
  failed build: fix it or `lint-allow` it with a reason.
- **No dead affordances.** A control that does nothing is a defect.

## Verify, four layers (the gate)

A new surface runs the full matrix. A correction reruns changed states and
their dependencies, reusing evidence only while its code, contracts and
runtime still apply. Keep one browser session for the phase and close it at
the gate with `browser::sessions::stop` (`browser::session-close` belongs to
the scraping API and leaves the tab open). Drive every state with
`browser::snapshot` and `browser::act`; `browser::evaluate` only reads state,
except to dispatch the `DragEvent`s a drag-and-drop check needs
(console-injectable-ui › Testing).

1. **Static:** the `build:ui` script (`pnpm build:ui` in a new worker)
   passes with a clean lint; the emitted asset keeps bare `react`,
   `@iii-dev/console-ui` and `lucide-react` imports.
2. **Delivery:** `console::ui-manifest` shows a fresh hash and an empty
   `warnings` array (select rows by `path`, see the backend playbook);
   `browser::fetch` of `/ui/<path>` returns the bytes.
3. **Real rendering:** `browser::navigate` to the page alone,
   `#/worker/<scope>[/<page-id>]`. A control that opens another of the
   worker's pages (`host.panels.open`, for example a Canvas link) is
   checked there too: click it, confirm with `browser::sessions::list` that
   a tab opened at `#/worker/<scope>/<page-id>?context=…`, then navigate to
   that URL and see the target render the context. Only chat renderers,
   session chips and palette rows need the full console,
   `console::workspace::open { "screen": "ext:<page-id>" }`: it is the
   workspace the operator is looking at, so close each screen you opened
   with `console::workspace::close` when its check ends. About 360 px, a
   narrow split and a wide pane; both themes; keyboard only; reduced
   motion; long names; every async state; a live update from a real
   mutation; reconnect.
4. **Evidence:** `browser::console::read` and `browser::network::read` at
   the end; an `[iii-ui]` error, a failed request or a call to an unknown id
   is a defect even when the screen looks right. One screenshot per state
   and width you claim, saved under the evidence path, and a plain list of
   what you did not verify. When a state you drove ran an acceptance
   criterion's `Verify:` exactly as written, add its `C<n>` line with the
   current `page.js` hash (profile › The hats keep the separations): Accept
   reuses it instead of observing it again.

Set `Frontend: done <when> · harness/ade-solo/frontend` in `Progress`, then
fetch the accept playbook.
