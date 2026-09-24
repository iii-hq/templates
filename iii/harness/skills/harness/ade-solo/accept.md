---
name: ade-solo-accept
type: how-to
description: >-
  Close a single-agent ADE build: give every acceptance criterion a current
  verdict by reusing the build phases' observations that still apply,
  observing only the gaps plus one smoke pass in the running ADE, and
  deliver the final message.
---

# Accept (Builder hat, with the Tech Lead's seam check)

Accept closes the build; it does not replay it. Every criterion is observed
in the running ADE by running its `Verify:`, once: an observation the build
phases recorded counts here while it still applies. Accept is the same
short procedure in every build, interactive or not: the ledger, the gaps,
one smoke pass. It runs even when every criterion is already covered.

## 1. The ledger (no browser yet)

- `console::ui-manifest`: the worker's current asset hashes and an empty
  `warnings` array. Asset rows carry `worker: null`; select them by `path`
  (`<scope>/page.js`, `<scope>/styles.css`).
- For each criterion, find its `C<n>` line in `specs/<worker>.evidence.md`.
  It still applies when its `page.js` hash equals the manifest's and
  `Progress` shows no change to the code, contracts or configuration it
  depends on after its time. Then the verdict is
  `met · reused from <phase> · <evidence>`, with no new browser step.
- Everything else is a gap: no line, a stale hash, a later change it
  depends on, or support only from a build, a typecheck, a direct function
  call standing in for a screen behaviour, or your own summary.

## 2. The run (one browser session)

1. Fetch in one batch the contracts not already in this conversation among
   `browser::sessions::start`, `browser::sessions::stop`,
   `browser::sessions::list`, `browser::navigate`, `browser::snapshot`,
   `browser::act`, `browser::screenshot`, `browser::network::read` and
   `browser::console::read`; add `console::workspace::open` and
   `console::workspace::close` only when a gap needs the full console.
2. `browser::sessions::start` on `<ADE URL>/#/worker/<scope>[/<page-id>]`
   (profile › The ADE URL; no lookup first).
3. **Smoke**, always: one `browser::snapshot` shows the page rendering from
   the current assets. When the ledger covered every criterion, go straight
   to step 5.
4. **Gaps** only: drive each gap's `Verify:` with `browser::snapshot` and
   `browser::act`, as a person would, and `browser::screenshot` each one you
   claim. `browser::evaluate` only reads state, except to dispatch the
   `DragEvent`s a drag-and-drop check needs. For live data, mutate outside
   the page with a real function call and watch the open page change.
   - Everything that stays on the worker's page is observed on the page
     alone, and so is a link that opens another of its pages
     (`host.panels.open`, for example a Canvas link): click it, confirm with
     `browser::sessions::list` that a tab opened at
     `#/worker/<scope>/<page-id>?context=…`, and navigate there to see the
     target render that context.
   - Only chat renderers, session chips and palette rows need the full
     console. It is the workspace the operator is looking at: open the
     screen with `console::workspace::open { "screen": "ext:<page-id>" }`
     and close it with `console::workspace::close` when its check ends.
5. `browser::network::read` and `browser::console::read`, once at the end:
   every call the page made reached the expected id with the expected
   response (the seam), and there is no `[iii-ui]` error, failed request or
   call to an unknown id. A defect there fails Accept even when the screen
   looks right.

## Verdicts

"Not fully observed" is not a verdict: move the check to where it can be
observed and run it there. Any criterion not met, partial or caveated:
close the browser with `browser::sessions::stop`, set
`Accept: failed: <criterion>` in `Progress`, and return to the phase that
owns the defect with only that criterion, its expected and observed result
and the evidence. After the fix the ledger decides again: recheck the
criteria the fix touched and their dependencies, keep the rest while they
still apply, and broaden when the impact is uncertain.

Never rewrite a criterion to match what was built. A wrong criterion is a
planning change: bring it to the user, edit the spec with them, then
re-verify against the revised criterion.

## Finish

All met: stop the browser session with `browser::sessions::stop`
(`browser::session-close` belongs to the scraping API: it answers
`closed: false` and leaves the tab open), close any screen you opened with
`console::workspace::open`, stop any worker process you started yourself
for checks, unregister any wake of yours still armed
(`harness::triggers::list`), set
`Accept: done <when> · harness/ade-solo/accept` in `Progress`, and answer in
this order:

1. How to open the tool: `<ADE URL>/#/worker/<scope>[/<page-id>]`.
2. One line per criterion: the verdict and its evidence, reused from a
   build phase or observed in Accept.
3. A short list of the files created or changed.
