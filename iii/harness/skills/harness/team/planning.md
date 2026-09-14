---
title: planning
type: how-to
description: >-
  Turn a feature conversation into work items whose descriptions stay the
  source of truth: interview first, write acceptance criteria as observable
  checks, create each item in state with its acceptance wake armed, and edit
  the item in the same turn the plan changes.
---

# Planning a feature into work items

## Open these first

- The `work-items` skill owns the write mechanics: ids, `merge`, messages,
  the wake. If it is not in your context:
  `directory::skills::get { "id": "harness/team/work-items" }`.
- `state::list { "scope": "work" }` — what is already planned. An item you
  cannot see is an item you will duplicate.
- `directory::agents::list {}` — the profile ids you may name as `owner` or
  `reviewer`.

State is the authoritative record. The chat is a scratchpad that is thrown
away when the session ends.

## The first move

`state::list { "scope": "work" }` **before you say anything about the
feature**. For every item you are about to touch, that read already holds its
description; rewriting one from memory is how a decision somebody already made
gets silently dropped.

## Interview before writing

Ask until you can answer all five in one sentence each. Those sentences become
the item.

1. Who is this for, and what do they do today instead?
2. What changes for them when this ships, the observable difference?
3. What is explicitly NOT in this slice?
4. How will we know it works, in a way a person can check without reading the
   diff?
5. What must exist before this can start: other items, an API, a decision?

If the user says "just write the items", answer 1–4 yourself, mark each answer
`Assumed:` in the description, and say the assumption out loud. Never ask a
question you can answer by reading state or the code.

## The description template

Every description is this, headings verbatim, in this order:

```markdown
## Problem
<one paragraph: who is hurt today, and how>

## Outcome
<what is true after this ships, from the user's side>

## Acceptance criteria
1. <subject> <action> → <observable expected result>. Verify: <URL, command, or screen>.
2. ...

## Out of scope
- <the thing a reasonable reader would assume is included, and is not>

## Notes
- Depends on: <item-id>
- Assumed: <anything you decided without confirmation>
```

The rules that make criteria usable:

- **One criterion per verifiable statement.** If it contains "and", it is
  probably two.
- **Name the actor and the observation.** "An operator sees the row in In
  review" beats "status updates correctly".
- **Every criterion carries a `Verify:`**: a URL, a command, a screen. A
  criterion nobody can check is a criterion that will pass on vibes.
- **Criteria describe behaviour, not implementation.** File paths, table
  names and module choices belong in `Notes` as constraints, never as
  criteria.
- **3–7 criteria.** More than that is two items.

## Split by outcome, not by layer

An item is a slice that can ship and be checked on its own.

- One item per observable outcome. "Add the search API and build the filter
  UI" is two outcomes, therefore two items.
- If two items must land together before either is checkable, they are one
  item.
- Ordering is `depends_on` on the record, mirrored by a `Depends on:` line in
  Notes, not a tenth criterion.
- Infrastructure with no observable outcome is a `Notes` line inside the item
  that needs it, not an item.

## Creating an item, and arming its wake

Choose a slug (`<feature>-<slice>`), check it is free, write the record:

```json
state::get { "scope": "work", "key": "search-filters-api" }      // must be null
```

```json
state::set {
  "scope": "work",
  "key": "search-filters-api",
  "value": {
    "id": "search-filters-api",
    "title": "Search filters persist across sessions",
    "status": "todo",
    "owner": null,
    "reviewer": "product-manager",
    "priority": "medium",
    "parent": null,
    "depends_on": [],
    "description": "<the template above>",
    "created_by": "product-manager",
    "updated_by": "product-manager"
  }
}
```

Then, in the same turn, arm the wake that brings the finished work back to
you:

```json
engine::register_trigger {
  "trigger_type": "state",
  "config": { "scope": "work:search-filters-api", "key": "to:product-manager" },
  "label": "search-filters-api-to-product-manager",
  "metadata": { "action": "report on search-filters-api for product-manager" },
  "lifecycle": { "expires_in_ms": 604800000 }
}
```

Seven days is the planning horizon; when the expiry notice arrives and the
item is still open, re-arm it. `owner` stays `null` unless the user names who
does the work, and then only with an id `directory::agents::list` returned.
`reviewer` is you unless the user says otherwise.

## The edit loop, the part that must not slip

The plan changes every few turns. Each change lands in the item **in the same
turn it is agreed**:

```json
state::update {
  "scope": "work",
  "key": "search-filters-api",
  "ops": [ { "type": "merge", "value": { "description": "<the FULL new body>", "updated_by": "product-manager" } } ]
}
```

`description` **replaces** the body: read the item, edit it, write the whole
thing back. Never a fragment, and never `state::set`, which would drop the
fields you did not mention.

Then report the change in prose ("criterion 3 now reads X, and I moved Y to
out of scope") and stop for confirmation. A plan the user has not seen written
down is not agreed.

If work is underway (`status` is not `todo`, or `state::list { "scope":
"work:<id>" }` shows a thread), do not rewrite the description: append a
`note` to `to:<owner>` describing the change, and wait for an answer.

## Traps

- **The plan lives in chat.** Symptom: the user comes back next session and
  the item still says what it said yesterday. Cause: you batched the update
  "for later". Fix: write it in the turn it is agreed, mid-conversation if
  need be.
- **You overwrote a record with `state::set`.** Symptom: `owner` or `status`
  reset. Cause: `set` replaces the value. Fix: `merge`, always, after
  creation.
- **An item nobody can start.** Symptom: the engineer replies with three
  questions. Cause: criteria written as intentions, with no `Verify:` line
  and no dependency list.
- **Two items that are really one.** Symptom: neither can be moved to
  `in_review` on its own.
- **Duplicate plan.** Symptom: two items with overlapping criteria. Cause:
  planning from memory instead of `state::list`.
- **You invented scope.** Symptom: the user reads the description and finds a
  feature they never asked for. Fix: ask, or mark it `Assumed:`.
- **The report never reached you.** Symptom: an item sits in `in_review` and
  your session never woke. Cause: no wake armed on `to:product-manager` for
  that item. Fix: arm it in the turn you create the item.

## Checklist

- [ ] `state::list { "scope": "work" }` read this session before any planning.
- [ ] Every created or edited item read back with `state::get` and matches
      what you told the user.
- [ ] Every item has ≥3 acceptance criteria, each with an observable result
      and a `Verify:` line.
- [ ] `Out of scope` is non-empty on every item.
- [ ] Every `depends_on` id exists in `work`.
- [ ] `updated_by: "product-manager"` on every merge; `owner` only set to an
      id `directory::agents::list` returned.
- [ ] A wake on `to:product-manager` armed per item you will review,
      labelled `<id>-to-product-manager`.
