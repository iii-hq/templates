---
title: review
type: how-to
description: >-
  Run the final review of a work item in in_review against its acceptance
  criteria: gather real evidence per criterion, answer the owner on the item,
  and send it back to in_progress the moment any criterion is unmet, partial,
  or newly caveated.
---

# Review against acceptance criteria

You are the gate, not a reader. An item leaves `in_review` for `done` **only**
when you have evidence for every acceptance criterion. Anything else goes back
to `in_progress` with the specific gap named.

## When this runs

You are woken by a `report` on `work:<id>` / `to:<you>`, or you find an item
with `status: in_review` whose `reviewer` is you. Either way:

```json
state::get { "scope": "work", "key": "search-filters-api" }        // the record
state::list { "scope": "work:search-filters-api" }                  // every thread on it
```

Copy the acceptance criteria out of the description **before** reading the
messages, so the engineer's summary cannot reframe what you are checking.
Then read the report.

## Three verdicts per criterion

| verdict | meaning |
| --- | --- |
| **met** | you personally observed the `Verify:` result, or its equivalent |
| **not met** | it does not hold, or holds only partially |
| **cannot verify** | no `Verify:` target exists, the thing is not reachable, or the only support is a claim |

`cannot verify` is **not met**. It is the most common false pass in a review.

## Evidence that counts

Each criterion's `Verify:` line names the check. Run it.

- A URL in a browser: `browser::sessions::start` when the user should watch
  it, `browser::screenshot-url` when they should not.
- An HTTP endpoint or a JSON API: `browser::fetch`; read `status` and the body,
  not just `ok`.
- A file, a config, a migration: read it with `coder::read-file` or
  `shell::exec` and quote the line.
- "The tests pass": run them.

A message saying "done, works" is a claim. A status of `in_review` is a
claim. Neither is evidence. Discover the ids with
`directory::search_functions` if they are not preloaded.

## The verdict, as two calls

**Reject**: any criterion not met or unverifiable. Message first, so the
reason is on the item before the status changes:

```json
state::update {
  "scope": "work:search-filters-api",
  "key": "to:backend-engineer",
  "ops": [ { "type": "append", "path": "messages", "value": {
    "from": "product-manager",
    "kind": "review",
    "body": "**Review: back to in progress.**\n\n- **AC 2 — not met.** Expected the empty state to read `No filters yet`; observed `undefined`. Verify: /search?filters=0\n- **AC 4 — cannot verify.** No `Verify:` target and no test covers it.\n\nReport again when AC 2 renders and AC 4 has a check attached."
  } } ]
}
```

```json
state::update {
  "scope": "work",
  "key": "search-filters-api",
  "ops": [ { "type": "merge", "value": { "status": "in_progress", "updated_by": "product-manager" } } ]
}
```

Name the criterion number, what you expected, what you observed, and what
would make it pass, one bullet per failed criterion. "Needs more work" is a
rejection that costs a round trip.

**Accept**: every criterion met:

```json
state::update {
  "scope": "work:search-filters-api",
  "key": "to:backend-engineer",
  "ops": [ { "type": "append", "path": "messages", "value": { "from": "product-manager", "kind": "review", "body": "**Review: accepted.** AC 1–4 verified against the stated checks." } } ]
}
```

```json
state::update {
  "scope": "work",
  "key": "search-filters-api",
  "ops": [ { "type": "merge", "value": { "status": "done", "updated_by": "product-manager" } } ]
}
```

A criterion that passed with a caveat is not passed; a caveat is a not-met.
That is the whole point of the gate.

Never `state::delete` an item, and never move an item you did not review.
The message goes to the item's `owner`; the owner's wake on `to:<owner>` is
what delivers it.

## When the item has a parent

An item with `parent` set was split off a larger one. Accepting it closes the
slice, not the feature. When every child of the parent is `done` and you have
exercised the seam between them in one run, append a `report` to the parent's
`to:<parent.reviewer>` naming the children and the seam evidence, and merge
the parent to `in_review`. The parent's reviewer runs this same skill on the
parent.

## Changing the criteria is a planning act, not a review act

If the criteria were ambiguous, wrong, or the work legitimately revealed new
scope, **do not silently rewrite them to match what was built, and do not
fail the engineer for building to a moving target.** Say on the item that the
criteria changed, take it back to the user as a planning decision, then edit
the description with a `merge` and re-review. A criterion rewritten after the
fact makes every future acceptance claim worthless.

## Keeping the loop armed

Your wake per item is on `work:<id>` / `to:<you>`, armed when you created or
dispatched the item (`planning` / `dispatch`), and re-armed as the first act
of every wake:

```json
engine::register_trigger {
  "trigger_type": "state",
  "config": { "scope": "work:search-filters-api", "key": "to:product-manager" },
  "label": "search-filters-api-to-product-manager",
  "metadata": { "action": "report on search-filters-api for product-manager" },
  "lifecycle": { "expires_in_ms": 604800000 }
}
```

- Re-arm **before** reading, so a second report cannot land unseen while you
  review. Then read the record and the thread, and act on every message you
  have not handled.
- On **accept** (`done`), `harness::triggers::unregister` the wake you just
  re-armed; `harness::triggers::list {}` shows its `subscription_id` under the
  label. On **reject**, leave it armed: the next report wakes you.
- You never wake on your own writes: your verdict goes to `to:<owner>` and to
  the record, neither of which you watch.
- The expiry notice is the backstop for a report that never comes. On it,
  re-read the item; re-arm if still open, stop if `done`.

## Traps

- **You accepted on a summary.** Symptom: the item is `done` and the bug it
  described is still reproducible. Cause: the engineer's report was read as
  evidence. Fix: one verdict per criterion, evidence per criterion.
- **`done` with a caveat.** Symptom: the item is closed and the caveat lives
  only in a message. Cause: "met, but…". Fix: a caveat is a not-met; message
  and move to `in_progress`.
- **The criteria moved after the work.** Symptom: the item passes against a
  description nobody built to. Fix: criteria changes go through the user as
  planning, in a separate turn.
- **Reviewed stale work.** Symptom: you approve a build that was superseded.
  Cause: you checked the artefact before the last report. Fix: read the
  whole thread, then review the newest state.
- **Your verdict reached nobody.** Symptom: the owner never resumes. Cause:
  you wrote to the wrong key (`to:Backend Engineer`, `to:backend`). Fix: the
  addressee is the record's `owner` string, character for character.
- **A wake armed on a closed item.** Symptom: a `[notification]` weeks later
  for an item that is `done`. Cause: you accepted without unregistering the
  re-armed wake. Fix: unregister on `done`, every time.

## Checklist

- [ ] Wake re-armed first, then record and threads read; criteria copied out
      **before** the messages.
- [ ] Every criterion has an explicit verdict: met / not met / cannot verify.
- [ ] Every "met" has an observation you can point at: a URL, a command, a
      quoted file line.
- [ ] Any not-met or cannot-verify → `review` message to `to:<owner>` naming
      the criterion, expected vs observed, then merge `in_progress`.
- [ ] Any accept → `review` message, then merge `done`, then unregister this
      item's wake.
- [ ] `from` and `updated_by` are your profile id on every write.
- [ ] A parent item gets its seam report and `in_review` only when every
      child is `done`.
- [ ] No item deleted, no criterion rewritten to fit the implementation.
