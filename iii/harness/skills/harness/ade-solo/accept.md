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
evidence, and the build phases' full matrices are not replayed here.

## Before the run

- Fetch only the contracts not already in this conversation among
  `console::ui-manifest`, `browser::sessions::start`,
  `browser::sessions::stop`, `browser::navigate`, `browser::snapshot`,
  `browser::act`, `browser::screenshot`, `browser::network::read` and
  `browser::console::read`. Discover extra tools only when a criterion needs
  them.
- `console::ui-manifest`: the worker's assets with current hashes and an
  empty `warnings` array. Require a changed hash only when asset bytes
  changed.
- The ADE URL: the one the user gave or the one in `Project context`;
  otherwise `http_port` from `configuration::get { "id": "default-ade" }`
  (compose names the entry `<namespace>-<container>`; if that id is absent,
  `configuration::list` shows it as `ADE`), then
  `http://127.0.0.1:<http_port>`. `3113` is only the first-run default.
  Record the URL and how you found it.

## The run

1. `browser::sessions::start` on the ADE URL. For a page criterion,
   `browser::navigate` to `<ADE URL>/#/worker/<scope>[/<page-id>]`; a chat
   renderer, session chip or palette row needs the full console through
   `console::workspace::open` with `screen: "ext:<page-id>"`.
2. Drive each criterion's `Verify:` with `browser::snapshot` and
   `browser::act`. Where it calls the worker, read `browser::network::read`
   to confirm the expected id answered the expected response: that is the
   seam. For live data, mutate outside the page with a real function call
   and watch the open page change.
3. `browser::screenshot` each criterion you claim; the user watches the
   live viewport while you check.
4. `browser::console::read` at the end. An `[iii-ui]` error, a failed
   request or a call to an unknown id is a defect even when the screen
   looks right.

## Verdicts

Any criterion not met, partial or caveated: close the browser, set
`Accept: failed: <criterion>` in `Progress`, and return to the phase that
owns the defect with only that criterion, its expected and observed result
and the evidence. After the fix, recheck the affected criteria and their
dependencies; keep earlier verdicts only while their code, contracts and
runtime still apply, and broaden when the impact is uncertain. Every
criterion needs a current verdict.

Never rewrite a criterion to match what was built. A wrong criterion is a
planning change: bring it to the user, edit the spec with them, then
re-verify against the revised criterion.

## Finish

All met: stop the browser session, unregister any wake of yours still armed
(`harness::triggers::list`), set `Accept: done <when>` in `Progress`, and
answer in this order:

1. How to open the tool: `<ADE URL>/#/worker/<scope>[/<page-id>]`.
2. One line per criterion: the verdict and its evidence.
3. A short list of the files created or changed.
