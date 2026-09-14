---
name: team
description: >-
  How a team of agent profiles plans, dispatches, builds and reviews work
  through the state worker: work items in the `work` scope, per-item message
  threads in `work:<id>` addressed by role, and `state` trigger wakes instead
  of polling or chat.
---

# team

Five documents, one loop. `work-items` is the protocol everyone shares; the
other four are the roles' halves of the same hand-off, written so that a
decision made in one profile's session reaches the next profile through
state and nothing else.

- `work-items` — the state layout (`work/<id>` records, `work:<id>` threads
  keyed `to:<profile-id>`), the wake pattern that never fires on your own
  writes, the status vocabulary, review-vs-done, never delete.
- `planning` — the Product Manager turns a conversation into items whose
  descriptions carry observable acceptance criteria, arms the acceptance
  wake, and edits the item in the same turn the plan changes.
- `review` — the gate: one verdict per criterion backed by something
  observed; any caveat sends the item back to `in_progress`.
- `dispatch` — the Tech Lead splits a feature on its seam, spawns one child
  per item with a full allow list, and stays reachable on message wakes.
- `worker-loop` — the dispatched engineer's loop: claim, arm the wake before
  reporting, report on the item, stop when it is `done`.

Fetch one with `directory::skills::get { "id": "harness/team/<name>" }`.
