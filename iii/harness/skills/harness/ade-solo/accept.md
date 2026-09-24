---
name: ade-solo-accept
type: how-to
description: >-
  Close a single-agent ADE build with one fresh browser run that checks the
  UI/service seam and observes every acceptance criterion in the running
  ADE, then deliver the final message.
---

# Accept (Builder hat, with the Tech Lead's seam check)

Separate sessions used to run an integration pass and then an acceptance
pass. You run one browser pass that covers both, and you start it fresh:
re-observe everything now. What you saw in the build phases is not
evidence, and the build phases' full matrices are not replayed here. This
phase runs in every build, including a non-interactive one.

## Before the run

- Fetch only the contracts not already in this conversation among
  `console::ui-manifest`, `console::workspace::open`,
  `browser::sessions::start`, `browser::sessions::stop`,
  `browser::navigate`, `browser::snapshot`, `browser::act`,
  `browser::screenshot`, `browser::network::read` and
  `browser::console::read`. Discover extra tools only when a criterion needs
  them.
- `console::ui-manifest`: the worker's assets with current hashes and an
  empty `warnings` array. Asset rows carry `worker: null`, so select them
  by `path` (`<scope>/page.js`, `<scope>/styles.css`). Require a changed
  hash only when asset bytes changed.
- The ADE URL: the one the user gave or the one in `Project context`;
  otherwise `http_port` from `configuration::get { "id": "default-ade" }`
  (compose names the entry `<namespace>-<container>`; if that id is absent,
  `configuration::list` shows it as `ADE`), then
  `http://127.0.0.1:<http_port>`. `3113` is only the first-run default;
  never guess a port or scan sockets. Record the URL and how you found it.
- Sort the criteria by where they can be observed. The page alone,
  `<ADE URL>/#/worker/<scope>[/<page-id>]`, serves a criterion that stays
  on the worker's page. A criterion about a chat renderer, session chip or
  palette row, or one that opens another page (`host.panels.open`, for
  example a Canvas link), needs the full console: on the page alone another
  page opens in a new browser tab or not at all.

## The run

1. `browser::sessions::start` on the ADE URL. For a page criterion,
   `browser::navigate` to the page alone; for a full-console criterion,
   `console::workspace::open { "screen": "ext:<page-id>" }` and drive it
   there.
2. Drive each criterion's `Verify:` with `browser::snapshot` and
   `browser::act`, as a person would. `browser::evaluate` only reads state;
   it never performs a criterion's action, except to dispatch the
   `DragEvent`s a drag-and-drop check needs. Where it calls the worker, read
   `browser::network::read` to confirm the expected id answered the
   expected response: that is the seam. For live data, mutate outside the
   page with a real function call and watch the open page change.
3. `browser::screenshot` each criterion you claim; the user watches the
   live viewport while you check.
4. `browser::console::read` at the end. An `[iii-ui]` error, a failed
   request or a call to an unknown id is a defect even when the screen
   looks right.

## Verdicts

"Not fully observed" is not a verdict: move the check to where it can be
observed (the full console for another page) and run it there. Any
criterion not met, partial or caveated: close the browser with
`browser::sessions::stop`, set `Accept: failed: <criterion>` in `Progress`,
and return to the phase that owns the defect with only that criterion, its
expected and observed result and the evidence. After the fix, recheck the
affected criteria and their dependencies; keep earlier verdicts only while
their code, contracts and runtime still apply, and broaden when the impact
is uncertain. Every criterion needs a current verdict.

Never rewrite a criterion to match what was built. A wrong criterion is a
planning change: bring it to the user, edit the spec with them, then
re-verify against the revised criterion.

## Finish

All met: stop the browser session with `browser::sessions::stop`
(`browser::session-close` belongs to the scraping API: it answers
`closed: false` and leaves the tab open), stop any worker process you
started yourself for checks, unregister any wake of yours still armed
(`harness::triggers::list`), set
`Accept: done <when> · harness/ade-solo/accept` in `Progress`, and answer in
this order:

1. How to open the tool: `<ADE URL>/#/worker/<scope>[/<page-id>]`.
2. One line per criterion: the verdict and its evidence.
3. A short list of the files created or changed.
