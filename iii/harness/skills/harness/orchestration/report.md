---
name: report
type: how-to
description: >-
  Deliver the result of a task you were spawned for: write one document to
  the state key your brief named, then stop. No parent to find, no wake to
  arm, no chat to summarise in.
---

# Reporting a result upstream

Your brief named a state key for your result. That key is the only place
your outcome is read. Nothing you say in chat reaches anyone; a summary
there is a result nobody receives.

You do not need to know who is waiting, or whether anyone is. Do not look
for a parent, do not arm a wake for a reply, do not poll. Do the work,
verify it the way your profile requires, write the key, stop. If more is
wanted from you, a new task arrives in this same session with the answer,
the rejection or the next step, and your transcript is kept.

## The write

One `state::set`, the whole document, to the exact scope and key in the
brief, character for character; a typo is a result written to nobody.

```json
state::set {
  "scope": "results",
  "key": "issue-board-backend-7f3a",
  "value": {
    "outcome": "done",
    "summary": "Registered issue-board::issue::list, ::create and ::move and verified each with a real call. The package builds and its tests pass. Not verified: behaviour under a database restart.",
    "evidence": [
      "engine::functions::list { prefix: \"issue-board::\" } → 3 ids",
      "issue-board::issue::create { title: \"x\" } → { id: \"i_1\", status: \"todo\" }",
      "pnpm test → 6 passed"
    ],
    "files": ["workers/issue-board/src/index.ts", "workers/issue-board/src/store.ts", "workers/issue-board/test/store.test.ts"],
    "questions": []
  }
}
```

- `outcome` is `done` or `blocked`. `done` only when every check assigned to
  you passed with current evidence, never just because something was written.
  Parent checks happen after your result; do not claim to have performed them.
- `summary`: what exists now, what you ran to prove it, and what you did
  **not** verify. A gap you name costs one round trip; a gap you hide costs
  a wrong acceptance.
- `evidence`: check ids, observed results and reproducible calls or source
  references. Distinguish checks you ran from child evidence you reviewed.
  Name the tested version/hash or runtime time so later readers can judge
  whether the evidence still applies.
- `files`: every path you created or changed.
- `questions`: empty on `done`. On `blocked`, the exact question whose
  answer unblocks you, with the options you see.

## Keep the result compact

Use at most 500 words, or the brief's tighter limit; simple results should
be shorter. Keep the same five fields. Put detailed check records, full
payloads, logs and screenshot paths in the evidence file named in the brief,
and cite its path and section in `evidence`. Each check must be covered there
or directly in the report. Include created evidence files in `files`.
For read-only tasks without file-write permission, cite the original source
locations instead. Never paste whole manuals, snapshots or child reports.

A correction reports what changed, what was rechecked and the overall
outcome. Reference earlier evidence for unaffected checks only when it still
applies; identify its source and why it remains valid. Do not hide a failed
or unverified required check to meet the length limit.

## Blocked

A brief that is ambiguous, contradicts the project, or needs a decision only
its author can make does not get a guess. Write `outcome: "blocked"` with
the question, then stop. Do not do half the work first; the answer may
change it.

## After the write

Stop. Do not wait, do not poll the key, do not register a wake for a reply.
When a new task lands in this session, read it as the answer to your last
result: fix what it names, verify again, write the same key again.

## Checklist

- [ ] The result is written to the scope and key the brief named, verbatim.
- [ ] `outcome: done` only with every assigned check evidenced; otherwise
      `blocked` with the question.
- [ ] Every check has a reproducible observation directly or in a cited
      artifact; firsthand checks and reviewed child evidence are distinguished.
- [ ] Result stays within the brief's limit (500 words by default).
- [ ] What was not verified is said in `summary`.
- [ ] Nothing in chat is the report; the turn ended after the write.
