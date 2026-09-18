---
name: console-injectable-ui
description: The authoring and delivery contract for worker UI injected into the running iii console — setup(host) and every slot, the runtime wire contract, Node registration, the shared build driver and its lint, scoped CSS, the hooks/format/icon packages, hot reload, debugging, testing layers and the definition of done — plus the responsive UX rules (pane-width behaviour, phone drill-in, bottom sheets, state integrity) and the configuration-form grammar. Use when adding or changing a worker's console UI. Visual rules and every number live in console-design; record-shaped recipes in patterns.
---

# Injectable console UI

A worker ships pages, function and trigger-activity renderers, forms, and
stylesheets into every console tab **at runtime** — no console rebuild, no
iframe, hot reload. This skill is the delivery contract and the behaviour of
the screen across widths and forms. Looks, tokens and every number:
`console-design` (link to `console-design` › Numbers, never restate one).
Composition recipes for record-shaped UIs: `patterns`.

> **Portable Node scaffold** (`index.md`, `harness/iii-node/index`): the
> worker is one Node package outside the `iii-hq/workers` monorepo. Its
> `package.json`, `ui/build.mjs`, `ui/tsconfig.json`, `scripts/dev.mjs` and
> the Node asset delivery are the Backend Engineer's boilerplate from
> `iii-node`; the Frontend Engineer edits `ui/page.tsx`, `ui/styles.css` and
> `ui/src/**`. `@iii-dev/console-ui` is installed from npm at **0.2.0 or
> later** — the release that ships the `/hooks` and `/format` subpaths,
> `build-worker-ui` and `lint-worker-ui` — and its types are read from
> `node_modules/@iii-dev/console-ui/` (`index.d.ts`, `hooks.d.mts`,
> `format.d.mts`). Monorepo paths this document names (`packages/console-ui`,
> `ade/web`, `state/`, `browser/`, `cron/`) are upstream examples, not files
> of this project: consult one only for a specific unresolved convention and
> never block on it.

## How it works

A worker registers `console:script` and `console:style` triggers whose
`config.path` identifies an asset and whose `function_id` serves `{content}`
for `{path}`. The console hashes and serves those bytes, then pushes changes
to open tabs. Tabs `import()` scripts and call their default `setup(host)`;
styles load as scoped `<link>` assets. Re-registering a path hot-reloads it.
Registration is deployment; disconnect is teardown.

## Project layout

```text
<worker>/
  ui/
    page.tsx      # the script asset — default-exports setup(host)
    styles.css    # the style asset — every rule scoped
    build.mjs     # buildWorkerUi({ scope, root: import.meta.dirname, outdir: '../dist/ui' })
    tsconfig.json
    src/          # page, renderers, config form, widgets
  src/
    ui.ts         # Node delivery: one content function + one trigger per asset
  dist/ui/        # page.js + styles.css — the bytes the worker serves
```

`@iii-dev/console-ui`'s root is types-only at build time; the console serves
its runtime from the running SPA. The scaffold's `pnpm build:ui` type-checks
and runs `ui/build.mjs`; `pnpm dev` (`scripts/dev.mjs`) is the hot reload for
both halves (The dev loop, below).

## Authoring workflow

1. Read the installed package's `index.d.ts`, `hooks.d.mts` and
   `format.d.mts`; never guess a component, hook or prop.
2. Select only the needed slots; model the primary object, navigation,
   actions, async states, and what must survive navigation or reload.
3. Choose one archetype (below); design wide and narrow flows separately.
4. Build with shared primitives and minimal scoped CSS; build (the driver
   scopes, checks tokens, lints), register, inspect the manifest, exercise
   the real console.

### Living references (upstream examples)

| Need | Read | Reuse |
|---|---|---|
| Public API | `node_modules/@iii-dev/console-ui/index.d.ts`, `hooks.d.mts`, `format.d.mts` | Exact exports and props |
| Shared page chrome | `ade/web/src/components/ui/PageChrome.tsx` | `PageShell`, `PageHeader`, surface roles |
| Migrated page, strict lint | `browser/ui/page.tsx`, `browser/ui/src/page/`, `browser/ui/styles.css` | Shared hooks/format/icons, `Toolbar`, `Eyebrow`, overlays, `lint: { strict: true }` |
| Migrated list/detail editor | `iii-directory/ui/page.tsx`, `iii-directory/ui/src/page/`, `iii-directory/ui/styles.css` | `SearchField`, `MetaRow`/`ActionLine`, `Kbd`/`KeyCombo`, dirty-draft guards, per-tab state |
| Migrated workbench | `ide/ui/page.tsx`, `ide/ui/src/page/`, `ide/ui/build.mjs` | `keyframePrefixes`, `allowUnscopedSelectors` for vendor CSS, `CodeEditor`/`FileDiff`, terminal atoms |
| Minimal template | `state/ui/page.tsx`, `state/ui/src/page/browser.tsx`, `state/ui/styles.css` | Smallest complete page + renderer + config form |
| Trigger-activity renderer | `cron/ui/src/trigger-activity/` | `host.triggerRenderers` and the canonical small settings form |

Copy delivery plumbing when it matches; never copy a reference's sidebar
count, thresholds, controls, or visual hierarchy without deriving them from
the new worker's content.

### Archetypes

Choose one dominant archetype before writing JSX. Mixing them produces a
generic dashboard with too many panels. Derive sidebar counts, thresholds and
controls from the worker's content, never from a reference's numbers.

| Archetype | Use for | Wide shape | Narrow shape |
|---|---|---|---|
| Console catalog | Many searchable objects with rich detail | Grouped list → persistent hero or breadcrumb + identity masthead + tabs; a contextual rail only for genuinely related information | List, then detail, one level at a time |
| Database workbench | Several tools operating on one selected resource | Compact mode switcher, collapsible resource tree, one active work surface, local toolbar and status bar, optional inspector | Tree as a full-width list; one tool at a time; inspector as a sheet |
| Directory editor | Searchable documents with drafts or preview | List → document identity → edit/preview modes; draft state stays mounted, save status beside the work | One mode at a time; edit and preview never side by side |
| State explorer | Deep but compact hierarchy | Progressive columns | One level at a time with a labelled Back |
| Settings flow | One configuration entry, host-owned persistence | Centered contained column; `SettingsDeck` for collections | Same column; deck opens one level |
| Terminal/instrument | One live surface (terminal, viewport, feed) | Toolbar above, status bar below, side rail for sessions | Rail becomes a list; surface fills the pane |
| Board | Records grouped by stage/status and moved between groups | Horizontally scrolling lanes on `--color-surface`, cards one step up, per-lane count and quiet add action, native drag-and-drop with a placeholder slot (`patterns` §1) | One lane at a time behind line tabs |
| Record screen | One record with body, properties and history | Its own pane opened through `host.panels.open`: masthead (mono key + status/priority marks + editable title), named-area grid with a sticky properties rail, Markdown body with inline edit, activity timeline with one composer (`patterns` §2–§4) | The same grid reflowed to one column |

A record detail is a screen, never a modal; creation is the only modal.

## Behaviour across widths

Do not shrink desktop UI into a phone. Change the interaction model when the
available width changes. Work in this order:

1. Inventory the behaviour, data, states, actions, dirty drafts, async work
   and existing constraints before changing markup.
2. Choose one archetype and one information architecture for the primary
   task. Define the wide flow and the narrow flow separately.
3. Decide which slot the surface belongs to: a full injected page, a function
   renderer, a trigger-activity renderer, a worker configuration form, a
   provider configuration form, or a compact chat slot (Slots, below).
4. Keep authoritative data, validation, persistence and navigation guards in
   the host. The injected worker owns presentation and worker-specific calls.
5. Build from shared primitives and design tokens. Add the least scoped CSS
   needed for the domain.
6. Exercise loading, empty, unavailable, unconfigured, dirty, saving, saved,
   error, reconnect and stale-response states.
7. Verify phone, narrow-pane and desktop behaviour in both themes with touch,
   mouse and keyboard before declaring the UI complete.

### Use the correct width signal

- The viewport breakpoint belongs to the console chrome only: phone
  presentation below it (bottom sheet instead of popover, the phone menu,
  phone-sized inputs and targets, safe-area padding), desktop at or above.
- Content inside a workspace pane responds to the pane. Every `PageShell` is
  a container: use `@container` in CSS for visual changes, and
  `useContainerNarrow` from `@iii-dev/console-ui/hooks` when React must
  mount a different narrow view (synchronous first measure, resizes
  observed, zero-width hidden panes ignored). A split desktop pane can be
  narrower than a phone viewport.
- Derive a container threshold from the minimum usable content width; the
  hook's default and the viewport breakpoint are in `console-design` ›
  Numbers. Never copy a threshold without checking the target content.

### Change structure on phones and narrow panes

- Replace side-by-side master/detail with a drill-in sequence: list →
  detail, scope → resource → value, or settings → category → choice. Render
  one primary page at a time with a visible, labelled back action; a row
  advances exactly one level. Never flatten parent and child collections
  into one selector or show a collapsed desktop rail first.
- Keep `PageSidebar` in its default inline narrow mode for that sequence; its
  full-width presentation is shared. Do not recreate rails, sheets, width
  overrides, or collapse state in worker CSS/JS. `narrowMode="drawer"` is
  only for secondary navigation over an unchanged, still-mounted `PageMain`.
- Build each level with `List`, optional `ListGroup`/`ListGroupLabel`, and
  `ListItem` (`selected`, `leading`, `label`, `description`, `trailing`)
  instead of copying row CSS; the shared row owns full-width targeting,
  neutral selection, keyboard traversal, focus, and touch height.
- Remove modes that require width: collapse split edit/preview to one mode
  at a time. Use `panelSide` to mirror side navigation in a wide right-hand
  pane, never reading order or a single-pane narrow flow.
- Keep editors mounted when hiding a mode if cursor and scroll continuity
  matter; unmount when state must reset between domain objects.

### Size interaction deliberately

- Primary rows, icon actions, and form controls meet the touch targets in
  `console-design` › Numbers on phones and in narrow split panes even when
  the desktop window is wide; compact desktop controls may shrink to the
  desktop size there. Phone text inputs use the phone input size so the
  browser does not zoom.
- Never hide an essential action behind hover on coarse pointers. Use
  `pointer-fine` only for hover-only disclosure. When a small visual icon
  must stay compact, enlarge its invisible hit area without changing layout.
- Keep focus rings visible, name every icon-only action (`IconButton`), mark
  decorative icons `aria-hidden`, and expose selected state with
  `aria-pressed`, `aria-current`, radio semantics, or a checkmark — not
  colour alone.

### Compose phone sheets correctly

`BottomSheet` (`BottomSheetContent`, `BottomSheetTitle`, …) is the shared
phone overlay: modal, inset, rounded raised panel, drag handle, close
target, `dvh`-based maximum height, safe-area padding, scope-preserving
portal. Compose on it; do not build a local sheet.

- Replace competing dropdowns and dialogs with one sheet and an in-place
  navigation stack (`push`, `back`, `reset`); avoid duplicate consecutive
  pages, reset after a successful close, and never open a second portal on
  top of the sheet for a sub-selection.
- Keep selector logic presentation-independent so desktop dropdowns and
  sheet pages share options, selected value, disabled rules, and callbacks.
- Keep dangerous confirmation as another page in the same sheet, or use
  `useConfirm()`; run the same unsaved-change guard for back, close, overlay
  dismissal, and sheet teardown.
- Keep the sheet header fixed; only the content scrolls
  (`overscroll-behavior: contain`). Use grouped rows with a strong label,
  quiet current value, optional icon, and chevron; radio-style rows for
  mutually exclusive choices.
- Avoid autofocus that opens the phone keyboard as soon as a sheet appears;
  keep keyboard-first autofocus in desktop popovers where useful.

### Prevent layout failures

- Put `min-width: 0` and `min-height: 0` on nested flex/grid children.
  Assign scrolling to the smallest region that needs it; never let the whole
  page scroll horizontally.
- Truncate ids, model names, paths, and tab titles deliberately; preserve
  the distinguishing tail of a filesystem path.
- Hide secondary metadata before squeezing the primary task: a details
  popover or sheet instead of a wrapping header; at narrow widths secondary
  header actions move into a `DropdownMenu`.
- Keep state mounted when hiding modes if cursor, draft, selection, or
  scroll continuity matters. Unmount only when changing domain identity must
  reset it.

### Preserve state through async work and reload

- Hydrate once, subscribe to changes, and unsubscribe on cleanup
  (`useWorkerLive` from `@iii-dev/console-ui/hooks` does this for
  fetch + trigger bindings + visible-tab poll).
- Use request ids, abort controllers, or monotonic tokens so an old response
  cannot overwrite a newer selection or edited value. Invalidate
  connection-test results as soon as any tested field changes.
- Key persisted UI state on `paneId` (fall back to `tabId`); `usePaneState`
  mirrors it to browser storage best effort. Guard dirty drafts before
  navigation and report them through `setDirty`.
- Expect script hot reload to dispose and remount slot components. Persist
  only state that must survive.

## 1. The script asset (`ui/page.tsx`)

Ordinary React. `react`, `@iii-dev/console-ui` and `lucide-react` resolve at
runtime through the console's import map, so they stay **external** (the
driver does this). Default-export `setup(host)` and make every registration
through `host`: the loader attributes registrations to the script and
disposes them on reload. `setup` may return a disposer (`SetupFn` in
`index.d.ts`); the loader runs it and the registrations LIFO.

```tsx
import { type Host, PageHeader, PageMain, type PageRenderProps, PageShell } from '@iii-dev/console-ui'
import { Boxes } from 'lucide-react'

function MyworkPage({ host, onRequestClose }: PageRenderProps & { host: Host }) {
  return (
    <PageShell className="mywork-ui-shell">
      <PageHeader icon={<Boxes />} title="Mywork" description={host.path} onClose={onRequestClose} />
      <PageMain className="mywork-ui-main">{/* the chosen archetype */}</PageMain>
    </PageShell>
  )
}

export default function setup(host: Host) {
  host.pages.register({
    id: 'mywork-manager',       // alone at #/worker/mywork/mywork-manager
    title: 'Mywork',            // nav label
    configurationId: 'mywork',  // host adds the standard settings action
    render: (props) => <MyworkPage host={host} {...props} />,
  })

  // Register other slots only when their implementations exist.
  // host.functionTriggers.register(createMyTriggerRenderer(host))
  // host.triggerRenderers?.register(createMyTriggerActivityRenderer())
  // host.configForms.register('mywork', MyConfigForm)
}
```

This is a delivery skeleton, not a finished design: compose one archetype in
its body before evaluating the UI. Imports from the shared package and from
`lucide-react` add zero bundle bytes.

### Slots

Every `register` returns a remover and is disposed automatically on hot
reload and worker disconnect. Namespaces marked `?` are absent on older
consoles: feature-detect them.

| Surface | What it is |
|---|---|
| `host.pages` | `register({ id, title, configurationId?, render })` registers a page the workspace opens through `host.panels.open` or `console::workspace::open { screen: "ext:<id>" }`, plus a nav entry; `#/worker/<scope>[/<id>]` renders it alone (Testing, below). `render` receives `PageRenderProps` (below). Set `configurationId` when the worker has a configuration entry; the host places the one settings action in `PageHeader`. Never mount `WorkerConfigurationDialog` yourself. |
| `host.functionTriggers` | Chat/trace renderers. Match only the worker's function ids; return `null` to fall through. `message.description` is the harness's short activity label. **`message.output` is not the function's return value**: the harness wraps results in an envelope `{ content: [...], details: <function result> }` and failures carry an `error` key — read it through `unwrapEnvelope` from `@iii-dev/console-ui/format`, and return `null` for error envelopes so the host's error view wins; `message.input` is the payload as sent. `metadata: { display: true }` keeps a successful rich artifact visible while raw details stay collapsed: `tryRenderDisplay` is the compact card the chat keeps in collapsed call groups, `tryRender` the expanded view. If raw data can contain secrets, implement a pure, total, cycle-safe `redactRaw`; the raw tab and copy action otherwise expose the original input/output. |
| `host.triggerRenderers?` | Layered trigger presentation; see below. |
| `host.configForms` | The deliberate form for one configuration entry in global Settings. There is no schema-generated fallback: every configurable worker registers one. The host owns dirty tracking, validation, save, reset and the SaveBar; honor `focusField`. `{ layout: 'full' }` only for a workbench that owns its scrolling. Form anatomy and primitives: Configuration forms, below. |
| `host.providerConfigForms?` | Replace the form body for one exact `llm-router` provider id inside the model picker; provider-owned OAuth, device flow or companion login. Never solicit a plaintext API key. Props: `ProviderConfigFormProps`. |
| `host.chat?` | `registerSessionChip`, `registerTurnSummary?`, `registerComposerAction?`, `registerTranscriptRenderer?`, `compose?`, `openDraft?`, `selectConversation?`, `composerModel?`, `requestWorkingDirectoryChange?`, `requestThinkingLevelChange?`. Feature-detect each method. |
| `host.panels?` | `open({ pageId, context })` places (or reuses) one of this script's registered pages **beside the caller in the same workspace tab** and delivers `context` as `PageRenderProps.panelContext` (`{ id, pageId, context }`; `id` increments per call so repeated opens re-navigate). This is how a card on a board or in chat opens a record as its own pane: register the record view as a second page, keep context small (ids) and fetch the body from the worker. Feature-detect and fall back to an in-pane drill-in. On a page rendered alone (`#/worker/…`) it delivers context in place to the page on screen and opens any other page in a new browser tab. |
| `host.overlays?` | `register({ id, render })` — a floating layer over the workspace (the browser's live preview). Fall back to the page when absent. |
| `host.palette?` | `registerSource({ id, title, kind, prefix?, minQuery?, search })` adds live rows to the command palette; `open({ query? })`. |
| `host.commands?` | `register(pageId, commands)` — palette rows for a page that may not be open yet (`run` usually calls `panels.open`). A mounted page contributes keys through `PageRenderProps.commands`. |
| `host.iii` | The tab's bus client: `trigger(functionId, payload?, { timeoutMs? })`, `on(functionId, handler)` (returns un-listen), `registerTrigger({ type, function_id, config })` (returns un-register), `addConnectionStateListener`, `browserId`. Injected UI *acts* by invoking its own worker's functions. `on('x', h)` registers the browser-local function **`x::<browserId>`**, so a binding must name `function_id: 'x::' + host.iii.browserId`. |
| `host.components`, `host.path`, `host.useTheme`, `host.uiClasses`, `host.workspace?`, `host.screen?` | Runtime component record, the current asset path, theme, class recipes, recent directories, visible-screen lease. |

`PageRenderProps`: `panelSide` (`'left' | 'right'`, only to keep wide side
navigation on the outer edge); `tabId` and `paneId?` (key persisted UI state
and per-instance resources on `paneId` — the same page can be open in two
columns of one tab — falling back to `tabId` on older consoles);
`onRequestClose?` (wire to `PageHeader.onClose`); `workingDir?` (the active
conversation's live directory, for filesystem-shaped pages only);
`panelContext?` and `conversationId?`; `setDirty?` (report unsaved work) and
`commands?` (palette rows and pane-scoped keys, registered from an effect).

Live data: a page registers its own trigger over `host.iii` with a handler id
like `iii::<worker>-ui::events::<browserId>` (the `iii::` prefix keeps it out
of the trace feed; the binding is GC'd with the tab). `useWorkerLive` from
`@iii-dev/console-ui/hooks` wraps fetch + bindings + visible-tab poll for a
page that refetches on events. Concretely, against a worker-provided
`<worker>:change` trigger type:

```ts
const FN = 'iii::<worker>-ui::events'
const offHandler = host.iii.on(FN, (event) => apply(event))
const offTrigger = host.iii.registerTrigger({
  type: '<worker>:change',
  function_id: `${FN}::${host.iii.browserId}`,
  config: {},
})
// teardown: offTrigger(); offHandler()
```

Create this binding **once per tab** (a module-level hub with a listener set
that registers on the first subscriber and tears down on the last), not once
per mounted component: two pages from the same script calling `on(FN)` would
fight over one function id. Events should carry the changed record so
consumers upsert locally instead of refetching (`patterns` §8).

Every injected render is error-bounded: import or setup failures drop the
extension's contribution and log to the browser console. Scripts run with full
console-origin privileges; the wrapper scopes styles, it is not a sandbox.

### Trigger renderers: layered ownership

```ts
interface TriggerActivityRenderer {
  id: string
  isMatch(triggerType: string): boolean
  tryRender(activity: TriggerActivityMessage): React.ReactNode | null
  tryRenderDetails?(activity: TriggerActivityMessage): React.ReactNode | null
  tryRenderDisplay?(activity: TriggerActivityMessage): React.ReactNode | null
  redactRaw?(value: unknown): unknown
}
```

`TriggerActivityMessage.kind` is `registration`, `fired`, or `retirement`;
the model carries `triggerType`, opaque `config`, optional `label` and
`action`, delivery, lifecycle and payload/outcome fields. Match `triggerType`
(many sources share `engine::register_trigger`), parse config without
throwing, return `null` per slot to fall through. `tryRender` is the
source-specific section inside the generic detail view; `tryRenderDetails`
replaces the whole expanded Terminal tab and must carry the lifecycle and
delivery facts the host no longer adds; `tryRenderDisplay` is the compact
timeline content inside the host's disclosure button — non-interactive, one
line, truncation-safe; `redactRaw` is pure, non-mutating, total, cycle-safe,
and a throw fails closed. The host owns the click target, expanded state,
motion, isolation, per-slot fallback and the Raw JSON tab; a once firing and
its automatic retirement are one activity.

For harness registrations, `label` names the binding and `metadata.action`
describes the future event:

```json
{ "trigger_type": "on-message", "config": { "scope": "explorer" },
  "label": "explorer-messages", "metadata": { "action": "new Explorer message received" } }
```

Registration and active-binding surfaces show `label`; show `action` only
when `activity.kind === 'fired'`. Action affects presentation only.

### Shared components, hooks, format, icons

`index.d.ts` is the only list of runtime exports: page chrome,
`List`/`ListItem`, cards, `Panel`, `Chip`/`Badge`, `IconButton`, the `Table`
family, line `Tabs`/`SegmentedControl`, `Select`/`Selector`/`Checkbox`,
inputs, `Dialog`/`ConfirmDialog`/`DropdownMenu`/`Tooltip`/`BottomSheet`,
status and empty states, `Eyebrow`, `Breadcrumb`, `SearchField`,
`Toolbar`/`StatusBar`, `MetaRow`/`ActionLine`, `Kbd`/`KeyCombo`,
`LiveRegion`, Markdown/JSON/code renderers, the terminal atoms (`AnsiText`,
`TerminalStream`, `TerminalCommandLine`), `CodeEditor`, `FileDiff`,
`ImageViewer`, `ModelPicker`, `DirectoryPicker`, and the settings primitives
(`SettingsSection`/`SettingsList`/`SettingsRow`/`SettingsField`,
`RawValueInput`, `SettingsDeck`). `<Tooltip label="…">` is the one-line
tooltip. Confirmation is `useConfirm()` (render `dialog`, `await confirm({ … })`)
or `ConfirmDialog` — never `window.confirm`. `uiClasses` holds the stable
class recipes (`list*`, `tree*`, `card*`, `panel*`, `chip`, `table*`,
`tabs*`, `field*`, `settings*`, `eyebrow`, `toolbar`/`toolbarEnd`,
`statusbar`, `spin`, `pulse`) and `tokens` the CSS variable inventory. When
to use each: `console-design` › Shared components.

Two subpaths **bundle** (React-free code the console itself uses):

- `@iii-dev/console-ui/hooks` — `useContainerNarrow({ below? })` (attach
  `ref` to the pane root; `narrow` while the pane is below the shared default
  from `console-design` › Numbers or your `below`; synchronous first
  measure, resizes observed, zero widths ignored), `useDebounce(value, ms?)`
  (remote queries), `useSplitDrag({ horizontal, begin, move, step })`
  (pointer + arrow keys for a `role="separator"`), `usePaneState(key,
  initial)` (`localStorage`-mirrored, best effort), `useCopyFlash(text, ms?)`,
  `useWorkerLive({ iii, triggers, fetch, pollMs?, handlerId })`.
- `@iii-dev/console-ui/format` — `formatRelative`, `formatDuration`,
  `formatBytes`, `unwrapEnvelope`, `errorMessage`, `errorCode`, `copyText`.

Import these instead of keeping a local copy.

Icons are `lucide-react`, an external shared with the console: `import { X }
from 'lucide-react'`. Never hand-write SVG icons (the lint flags them) and
never add another icon dependency. Sizes: `console-design` › Numbers.
Never bundle Monaco, CodeMirror, a diff renderer, or an ANSI parser; use
`CodeEditor`, `FileDiff`, and the terminal atoms.

## 2. The style asset (`ui/styles.css`)

Plain CSS, **every top-level rule scoped under the worker's wrapper
attribute** — the console mounts each render inside
`<div data-iii-ui="<first path segment>" style="display:contents">`:

```css
[data-iii-ui="mywork"] .mywork-ui-main {
  min-width: 0;
  min-height: 0;
  overflow: auto;
}
@keyframes mywork-flash { /* keyframe names are global: prefix them */ }
```

- Colors, fonts, radius, shadows and motion are tokens: `var(--color-…)`,
  `var(--font-sans|mono|code)`, `var(--radius-…)`, `var(--shadow-…)`,
  `var(--motion-duration-…)`/`var(--motion-ease-…)`. `checkTokens` fails the
  build on a token the console does not define. Which token means what:
  `console-design` › Tokens.
- Keyframe names carry the worker prefix (`keyframePrefixes`, default
  `[scope, "<scope>-ui"]`); spin/pulse are `uiClasses.spin`/`uiClasses.pulse`.
- Responsive layout is `@container` on the pane (every `PageShell` is a
  container), never a viewport `@media`; the viewport breakpoint is reserved
  for the console's phone chrome.
- No unscoped selectors (`:root`, `html`, `body`, `*`, bare elements), no
  `@font-face`: injected CSS is unlayered and would beat the console's
  layered stylesheet document-wide. `assertScoped` refuses the build; the
  console's fetch-time lint reports leftovers in the manifest's `warnings`.
- No Tailwind utility classes in injected markup — worker class names are not
  in the console's compiled output. Shared components and `uiClasses` first;
  scoped CSS only for domain layout and data visualization.
- Scope `@media (prefers-reduced-motion: reduce)` overrides too (shared
  recipes already honor it); streaming, rapidly updating and pointer-following
  values update without transitions.
- Shared `Dialog`, `DropdownMenu`, `Select`, `Selector`, `Tooltip`, and
  `BottomSheet` portals preserve the worker scope. A custom `document.body`
  portal stamps `data-iii-ui="<worker>"` on its root (and lists it in
  `allowUnscopedSelectors` if its rules live outside the scope).

## 3. The build (`ui/build.mjs`)

`buildWorkerUi` (`@iii-dev/console-ui/build-worker-ui`, typed in
`build-worker-ui.d.mts`) is the one esbuild driver. In the portable layout
`ui/build.mjs` is the whole call, run from the package root by `pnpm build:ui`:

```js
import { buildWorkerUi } from '@iii-dev/console-ui/build-worker-ui'

await buildWorkerUi({ scope: 'mywork', root: import.meta.dirname, outdir: '../dist/ui' })
```

| Option | Default | Purpose |
|---|---|---|
| `scope` | required | The `data-iii-ui` value — first asset path segment, normally the worker name |
| `entryPoints` | `['page.tsx', 'styles.css']` | Extra scripts each need their own `console:script` trigger and a default `setup` |
| `outdir`, `root` | `'dist'`, `process.cwd()` | Paths resolve against `root`; pass `import.meta.dirname` when invoked from elsewhere |
| `keyframePrefixes` | `[scope, "<scope>-ui"]` | Allowed `@keyframes` name prefixes |
| `allowUnscopedSelectors` | `[]` | Selector prefixes that are global on purpose (a portal root, vendor CSS such as `.xterm`) |
| `strictTokens` | `true` | Unknown design token fails the build (`false` warns) |
| `lint` | `{}` | `false` skips the design-rule lint; `{ strict, disable, allow }` tunes it |
| `watch`, `minify` | `--watch` flag, `!watch` | Watch rebuilds unminified for readable traces |
| `plugins`, `extraExternal`, `define` | | Passed to esbuild |

After every build it checks each asset against the 8 MiB cap, runs
`assertScoped` on every sheet and `checkTokens` on everything; a non-watch
build then runs `lintWorkerUi` on the source. A failed check exits 1.

Six specifiers stay external because the console's import map serves them:
`react`, `react-dom`, `react-dom/client`, `react/jsx-runtime`,
`@iii-dev/console-ui`, `lucide-react`. The driver matches them **exactly**
(`workerUiExternalsPlugin`) because esbuild's `external` list would also
externalize `@iii-dev/console-ui/format` and `/hooks`, which must bundle.
Everything else bundles in. Only those six exist in the import map: a
dependency importing another bare react-family specifier (`react-dom/server`)
fails at `import()` time. A custom pipeline imports `workerUiExternals`,
`assertScoped`, `checkTokens` and, from `@iii-dev/console-ui/lint-worker-ui`,
`lintWorkerUi`/`formatLint`, and runs the same checks; dropping the `react`
external there bundles a second React ("Invalid hook call"), dropping
`@iii-dev/console-ui` throws at once with the fix.

### Lint

`lintWorkerUi({ root, scope, strict, disable, allow })` scans `styles.css`,
`page.tsx` and `src/**` under `root` (never `dist/` or tests); errors fail
the build, warnings print. `strict: true` promotes warnings (every migrated
upstream worker turns it on); `disable: ['rule']` drops a rule;
`allow: { rule: ['substring', /re/] }` ignores matching excerpts; a
`lint-allow <rule>` comment on the finding's line or the one above does the
same in place — always with a reason.

| Rule | Level | Flags |
|---|---|---|
| `no-window-dialogs` | error | `window.confirm/alert/prompt(` — use `useConfirm()`/`ConfirmDialog` |
| `icon-size` | error | Lucide `size`, `<svg width/height>` or `size-3`/`w-3 h-3` classes below the icon baseline |
| `accent-selection` | error | `var(--color-accent…)` in a selected/active/current rule (focus excepted) |
| `no-inline-svg` | warning | `<svg` in a `.tsx` outside `icons.tsx`/`icons/` — import from `lucide-react` |
| `radius` | warning | `border-radius` other than `0`, the system radius, full rounding, `var(--radius-*)`, `inherit` |
| `font-family` | warning | anything but `var(--font-…)`/`inherit` |
| `font-size` | warning | below the UI text floor |
| `case-transform` | warning | `text-transform`/`textTransform:` — use `Eyebrow`/`uiClasses.eyebrow` |
| `focus-stroke` | warning | `:focus`/`:focus-visible` outline, box-shadow or border in accent — use `--color-rule-focus` |
| `shadow` | warning | `box-shadow` that is not `var(--shadow-*)`, `none` or a token inset/hairline |
| `hex-color` | warning | `#hex`/`rgb()`/`hsl()` literals (custom properties on the scope root are fine) |
| `motion-literal` | warning | `transition`/`animation` with a literal `ms`/`s` duration |
| `keyframes-shared` | warning | `@keyframes …spin/pulse/shimmer/fade` — use `uiClasses.spin`/`uiClasses.pulse` |
| `viewport-media` | warning | `@media (max-width|min-width …)` — use `@container` |
| `tailwind-in-worker` | warning | `className` strings with several Tailwind utilities |

The baseline, floor and radius the rules check are the values in
`console-design` › Numbers. CLI, from the package root:
`node node_modules/@iii-dev/console-ui/lint-worker-ui.mjs ui [--strict] [--json]`.

## 4. Registration (the worker side)

One content function serving all of the worker's assets (dispatch on
`path`), one trigger per asset. A Node worker implements the wire contract
directly: one function mapping `{path}` to `{content, content_type?}`, then
one Message-path `console:script` or `console:style` trigger per asset with
`config: {path}`. The scaffold's `src/ui.ts` is written in
`harness/iii-node/index` › Worker-side asset delivery; keep the first path
segment equal to the worker name and reject unknown paths.

**Always register through the SDK's Message path, never the engine's durable
`register_trigger`:** Message-path triggers are garbage-collected on
disconnect and replayed on reconnect.

## Runtime contract

| | |
|---|---|
| Trigger types | `console:script` (ESM JS), `console:style` (CSS); never register the tab-only `console:assets` type |
| Trigger config | `{ "path": string }`, nothing else |
| Path rules | lowercase `[a-z0-9._-]` segments, no leading slash, no `.`/`..` segments, ≤ 512 chars; extension must match the type (`.js` / `.css`); **convention: first segment = worker name** — it becomes the `data-iii-ui` scope and the only human-readable attribution |
| Content function | input `{ "path": string }` → output `{ "content": string, "content_type"?: string }` |
| Size cap | 8 MiB per asset — larger registrations are rejected (the driver fails first) |
| Reload | same path + changed content hash replaces the asset; unchanged content is a no-op |

## Configuration forms

Treat the provider settings flow as the baseline for every worker
configuration: focused, status-aware, schema-respecting, responsive, and
host-owned at the persistence boundary. `database` is the canonical
resource-deck example upstream; `cron` the canonical small settings form.

### Keep the ownership boundary strict

The form receives a complete JSON draft and proposes a complete next draft
(`ConfigFormProps` / `ProviderConfigFormProps` in `index.d.ts`; only the
former carries `focusField`). The console owns loading, baseline, dirty
comparison, merged client and server validation, navigation guard,
Save/Reset, mutation status, and the sticky save bar. Never save from the
component and never keep a second persistent copy of the draft. Call
`onChange` with immutable updates, preserve unknown keys and siblings,
unknown enum/adapter payloads and templates, and delete an optional key
(`delete next[key]`) to restore its default; display defaults without
materializing them. An opaque root is preserved like an opaque nested block
and requires an explicit conversion; never coerce it to `{}` to enter the
typed form.

### Use the shared form grammar

Every `host.configForms` implementation uses host-owned primitives. Do not
paint native inputs, selects, switches, buttons, or a private collection deck
to resemble the console, and never render a raw JSON textarea.

- Structure ordinary settings as `SettingsSection` → `SettingsList` →
  `SettingsField`/`SettingsRow`.
- `SettingsField` for editable values: pass every prop supplied by its
  `renderControl` callback into `Input`, `Select`, `Selector`, `Switch`, or
  a domain wrapper. It generates the clickable label, description/error
  ARIA, `data-field`, and standard control width. Use `controlSize="fit"`
  with `layout="inline"` for intrinsic controls such as `Switch`.
- `SettingsRow` for values or actions that are not a single labelled field.
- `RawValueInput` for `${ENV}` templates and unknown/future scalars. It may
  suggest a typed literal, but conversion happens only after the user
  invokes `onUseLiteral`. A non-string opaque value still belongs in a
  `SettingsField` with an explicit conversion button so errors stay
  associated with the control.
- `Select` for finite choices, `Selector` for searchable ones. Both support
  `id`, `name`, and `data-field`; a native `<select>` with worker CSS is
  never the fallback.
- Worker CSS may arrange controls, constrain width, or apply mono to a
  machine-readable value. It must not override shared control color,
  border, radius, height, chevron, focus, disabled, or type styles.
- Put `data-settings-narrow-action` on standalone empty-state actions so
  they use the shared narrow target rule.

For a collection whose item opens a meaningful sub-form, use `SettingsDeck`.
Its `overview` composes `Panel` + `List`/`ListItem`; its `detail` holds the
selected item's settings. `open` selects exactly one level at every width.
The deck focuses the pushed heading and restores the originating row on
Back. Keep selection by a stable domain key and set it to `null` when the
item is removed. For a host deep link, open the requested item first, focus
the exact `data-field`, and temporarily disable `autoFocusDetail`; encode the
host path as `focusField.map(String).join('.')`, use that dotted value in
`SettingsField.field`, and consume each request once after the deck content
mounts. Put `data-settings-deck-fallback` on the surviving overview action
that should receive focus when a removed item's row disappears.

```tsx
<SettingsField
  id="redis-url"
  field="adapter.config.redis_url"
  label="Redis URL"
  error={errors?.get('/adapter/config/redis_url')}
  renderControl={(controlProps) => (
    <Input {...controlProps} value={redisUrl} onChange={setRedisUrl} />
  )}
/>

<SettingsDeck
  open={activeId !== null}
  title={activeItem?.label ?? 'Connection'}
  backLabel="Connections"
  overview={<ConnectionList onOpen={setActiveId} />}
  detail={activeItem ? <ConnectionSettings item={activeItem} /> : null}
  onBack={() => setActiveId(null)}
/>
```

### Use an anatomy that answers operator questions

1. Start with identity and live status only when it changes what the
   operator should do: connected/unconfigured, available/unloaded,
   model/resource count, active adapter, or restart required.
2. Put authentication or connectivity first. Explain where credentials live
   and provide a test/check action when the worker can verify them.
3. Group domain settings by mental model, not schema nesting: one section
   label and a quiet grouped surface for related rows.
4. Explain defaults and operational units beside the field; translate raw
   milliseconds, bytes, or token caps into human-readable echoes
   (`formatDuration`, `formatBytes` from `@iii-dev/console-ui/format`).
5. State when a setting hot-applies, applies on the next request, or requires
   a worker restart. Reveal advanced settings progressively.
6. End with inline root errors if no field can own them; keep field errors
   next to their controls.

There is no generic schema-form fallback: use the schema for draft
validation, never for UI generation. Even a simple configuration gets
purpose-written labels, grouping, defaults, and reload semantics.

### Handle secrets and authentication safely

- Never render a plaintext API-key field in provider configuration. If the
  provider declares a credential environment variable, show its exact name
  in a copyable mono token and explain that the key belongs in the runtime
  environment, outside stored configuration.
- If no credential variable exists, authentication is provider-owned: show
  its OAuth, device, CLI, local app, or companion-login instructions and
  expose a safe check/refresh action through the provider worker.
  Distinguish API-key providers from subscription/login providers explicitly.
- Do not treat `configured === false` as decisive for provider-owned auth; a
  discovered model catalog is authoritative evidence the provider works.
  Interpret `available === false` as worker unavailable, not merely missing
  credentials; keep the two messages distinct.
- After a successful host save, let the host refresh provider and model state.

### Make fields robust

- Derive visibility from the registered schema; do not expose fields the
  worker cannot accept. Render optional overrides with an explicit enable
  switch when property presence changes semantics; switching off deletes
  the key.
- Parse numbers without committing `NaN`; keep the empty state `undefined`
  when it means "use default"; apply schema min/max; use `inputMode` where
  appropriate.
- Give every control a stable label/id pair. Help text is for consequences,
  not to repeat the label.
- Map errors by JSON Pointer, surface them with `role="alert"`, clear stale
  server errors after edits, and keep Save disabled while client validation
  fails. Honor `focusField`: escape the selector segment, focus the matching
  element, and scroll it to the center.
- Guard renames or identity edits until blur/explicit commit so intermediate
  text cannot collide with sibling keys. For async tests, show checking,
  success with useful facts, and a concise error; ignore completion if the
  value changed or the component unmounted.

### Make configuration responsive

- Use the centered contained column for ordinary forms; request
  `{ layout: 'full' }` only for workbench-style configuration that owns its
  scrolling.
- Size controls from the pane, not the viewport: Back, section/row actions
  and field controls meet the touch target in a narrow split pane even on a
  wide desktop window (`console-design` › Numbers). Phones get phone text
  size, stacked action buttons, and readable help text; desktop compacts
  controls without changing information architecture.
- Keep the host save bar sticky and always reachable; never cover it with
  internal scrolling.
- In a model-picker sheet or dropdown, keep provider configuration inside
  the current navigation surface and run the dirty guard before back or
  close.

## The dev loop (hot reload)

Rebuild-on-save stays in the build tool; re-registration stays in the worker.
In the portable layout `pnpm dev` (`scripts/dev.mjs`, from `iii-node`) runs
both: a save under `ui/` rewrites `dist/ui/`, restarts the worker, and the
worker re-registers the same asset paths with new content hashes. Every open
tab hot-swaps the asset: scripts re-`import()` + re-`setup()` (slot React
state is lost), styles link-swap with no flash; unchanged content is
hash-deduped end to end. If the loop is not running, start it with the
project's own command before you build.

## Debugging

| Symptom | Cause |
|---|---|
| Build exits 1 naming a selector | an unscoped rule, unprefixed `@keyframes` or `@font-face` — `assertScoped` |
| Build exits 1 on `unknown token` | a `var(--color-…)` the console does not define — check `token-names.mjs`, or declare it on the scope root |
| Build exits 1 on `design-rule error(s)` | a lint error (or a warning under `strict`) — fix it or `lint-allow` it with a reason |
| Registration rejected with a path error | path violates the rules table (wrong extension, uppercase, `..`, …) |
| Registration rejected with a fetch error | the content function threw, returned no string `content`, or timed out |
| "Invalid hook call" in the tab | a second React in the bundle — a custom build dropped an external |
| `import()` fails on a bare specifier | a dependency imports a react-family subpath outside the six shared specifiers |
| Styles apply on the page but not in a custom portal | a custom `document.body` portal must carry `data-iii-ui="<worker>"` on its root |
| Whole console restyled | unscoped rules reached the console — check `warnings` in the manifest |
| Registered but absent | inspect `workers[].enabled` and `injectableUi.disabledWorkers` in the manifest |
| Chat renderer matches but the generic JSON view still shows | `tryRender` read `message.output.<field>` — the result is the `{ content, details }` envelope; `unwrapEnvelope` it |
| Chat card never appears in a collapsed call group | renderer lacks `metadata: { display: true }` or `tryRenderDisplay` returned `null` |
| Live events never reach the page | the binding's `function_id` misses the `::<browserId>` suffix, or the worker's provider did not pass `binding.namespace` through to `trigger()` |
| A dragged card vanishes and never comes back | the list removed the card while dragging and `dragend` never fired; keep it mounted (dimmed) and clear state from document-level `dragend`/`drop` |
| Detail opened inside the board instead of a new pane | use `host.panels.open({ pageId })` with a separately registered page rather than local selection state |

Inspect `console::ui-manifest` (or `GET <console-host>:3113/ui`),
`/ui/<path>`, registered triggers, and `[iii-ui]` browser logs in that order.
The manifest is authoritative; its `warnings` must be empty.

## Testing

Validate all four layers; a green build alone is not enough.

1. **Static:** `pnpm build:ui` — type-check, scoped and token-checked
   assets, lint clean (strict where enabled), no bundled React, editor or
   ANSI parser (`dist/ui/page.js` keeps bare `react`, `@iii-dev/console-ui`
   and `lucide-react` imports; release builds are minified).
2. **Embedding:** the worker's asset tests — accepted paths, an ESM export,
   the built CSS scope (esbuild may omit selector quotes and whitespace).
3. **Delivery:** boot engine + console + worker; manifest paths, hashes, no
   warnings, fetchable bytes (`browser::fetch` of `/ui/<path>`), a changed
   hash after hot reload.
4. **Real rendering:** the actual console at a phone-sized, a narrow split
   and a wide pane (`console-design` › Numbers), both split positions,
   both themes, keyboard only, reduced motion, long content, every async and
   live-update state, dirty navigation, reconnect — the matrix below. The
   `browser` worker drives it: `browser::sessions::start` on the console
   URL, `browser::resize` for each width, `browser::snapshot` for
   structure, `browser::act`/`browser::evaluate` for interaction,
   `browser::screenshot` for both themes (toggle
   `document.documentElement.dataset.theme` to preview dark), and
   `browser::console::read` at the end. Synthetic pointer drags do not
   fire HTML5 drag events; dispatch `DragEvent`s to test drag-and-drop.
   For `host.triggerRenderers` add exact type match, malformed-config
   fallthrough, every slot and activity kind, non-interactive compact
   display, complete-detail lifecycle fidelity, action fallback, fail-closed
   redaction, and disable/disconnect fallback.

**The page alone: `#/worker/<scope>[/<page-id>][?context=<json>]`.** The
console renders that one page over the full viewport — no tab strip, chat or
palette; the tab title is `iii - <scope>` — and never reads or writes the
shared workspace layout, so a Playwright or `browser`-worker session can open
a worker's page directly for screenshots and drive-through. `scope` is the
worker's asset namespace (`mywork/page.js` → `mywork`, the `data-iii-ui`
value); omit the page id for the worker's first page. `context` replays a
`host.panels.open` context on load. What still works there: the page's
settings action and the settings shortcut (the configuration overlay opens in
place), the page's keyed commands, hot reload and the worker's overlays.
`host.panels.open` delivers context in place for the page on screen and opens
any other page in a new browser tab. `#/traces` renders the traces explorer
the same way. Chat slots and the palette are out of its scope: validate those
in the full console, opened through `console::workspace::open`.

### Interaction matrix

- A phone viewport, a narrow desktop split pane, and a wide pane (widths:
  `console-design` › Numbers); left and right split positions; light and
  dark themes.
- Touch, pointer, keyboard-only, visible focus, reduced motion; neutral
  selected rows, cards, tabs, chips, and segments in both themes;
  responsive transitions and immediate high-frequency updates.
- Long names, paths, model ids, descriptions, and payloads; loading, empty,
  unavailable, unconfigured, success, error, reconnect, and hot-reload states.
- Sheet back/close, overlay dismissal, native browser Back where applicable,
  and dirty-draft confirmation; screen-reader names, roles, live status
  (`LiveRegion`), progress values, and selected state.
- No horizontal page overflow and no content hidden behind safe areas or the
  sticky save/composer regions.

## Definition of done

- `PageShell` + `PageHeader` present, close action wired;
- every configurable page declares `configurationId`; every configuration
  entry has a purpose-built `host.configForms` form that preserves
  unknown/template data and restores focus on Back;
- controls, hooks, formatters and icons come from `@iii-dev/console-ui`, its
  `/hooks` and `/format` subpaths, and `lucide-react` — no local copies;
- the primary task is obvious at every width; the narrow flow exposes every
  action without hover or horizontal overflow; focus is visible, controls
  have names, targets and text sizes meet `console-design` › Numbers;
- selection is neutral in both themes; styles are scoped and token-based;
- the build passes `strictTokens` and a clean lint (`strict` once migrated);
- async responses cannot overwrite a newer selection or a dirty draft; page
  and configuration state cannot be lost silently; secrets never appear in
  editable provider configuration; the host still owns validation and
  persistence;
- reconnect and hot reload leave no duplicate registrations; the manifest has
  no warnings and the browser console has no `[iii-ui]` errors.
