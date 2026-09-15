---
name: work-items
type: how-to
description: >-
  The shared protocol for working as a team through the state worker: where
  a work item lives, how to claim, report and hand it off, and how to be
  woken by a message addressed to you without ever waking on your own writes.
---

# Work items in state

There is no board worker and no `harness::send` between agents. The `state`
worker is the only wire: every item is a value, every message is a value, and
the `state` trigger type wakes the session that is waiting for it. Reads never
fire triggers; `state::set`, `state::update` and `state::delete` do.

## Layout

| scope | key | value |
|---|---|---|
| `work` | `<item-id>` | the item record below — `state::list { "scope": "work" }` is the whole board |
| `work:<item-id>` | `to:<profile-id>` | `{ "messages": [ { from, kind, body, at? } ] }` — everything addressed to that role about that item |

The item record:

```json
{
  "id": "search-filters-api",
  "title": "Search filters persist across sessions",
  "status": "todo",
  "owner": null,
  "reviewer": "product-manager",
  "priority": "medium",
  "parent": null,
  "depends_on": [],
  "description": "## Problem\n…\n## Acceptance criteria\n1. … Verify: …",
  "created_by": "product-manager",
  "updated_by": "product-manager"
}
```

- `id` is a lowercase kebab slug the planner chooses (`<feature>-<slice>`).
  It is the key, so it never changes. `state::get` it before the creating
  `state::set`; an existing value means pick another id.
- `status` is one of `todo`, `in_progress`, `in_review`, `done`. Nothing
  else. A rejected review goes back to `in_progress`.
- `owner` and `reviewer` are profile ids exactly as `directory::agents::list`
  returns them (`backend-engineer`, never "Backend Engineer"). Messages are
  addressed with these strings, so a typo is a message nobody receives.
- `parent` names the item this one was split from, or `null`. `priority` is
  `low`, `medium`, `high` or `urgent`.

## After creation, write with `update`, never `set`

`state::set` replaces the whole value, so two sessions writing the same item
clobber each other. Every change after creation is a root `merge`:

```json
state::update {
  "scope": "work",
  "key": "search-filters-api",
  "ops": [ { "type": "merge", "value": { "status": "in_progress", "owner": "backend-engineer", "updated_by": "backend-engineer" } } ]
}
```

`ops` apply atomically in order; `merge` touches only the keys you name. Put
`updated_by` (your profile id) in every merge.

## Messages: append to the addressee's key

A message goes to a **role**, on an **item**, and is appended, never replaced,
so nothing is lost between two wakes:

```json
state::update {
  "scope": "work:search-filters-api",
  "key": "to:tech-lead",
  "ops": [ { "type": "append", "path": "messages", "value": { "from": "backend-engineer", "kind": "report", "body": "…" } } ]
}
```

`append` on a key that does not exist yet creates `{ "messages": [ … ] }`; no
setup write is needed, and array order is arrival order (add `at` as an ISO
timestamp only when you actually know the time). `kind` is one of `report`,
`review`, `question`, `answer`, `note`. To read a thread:
`state::get { "scope": "work:<id>", "key": "to:<role>" }` for one addressee,
`state::list { "scope": "work:<id>" }` for every addressee at once.

**You write to other roles' keys and watch only your own.** That is the whole
loop guard. The `state` trigger filters by scope and key only, with no author
filter and no self-suppression, so a session that watched a key it also
writes would wake on its own reports. With `to:<role>` keys the guard is
structural: nothing you write is something you watch.

## The wake

A wake is a `state` trigger registered without a `function_id`; the event
arrives as a message in your session and starts a turn. Register it
**before** the write that invites the answer. Events do not replay, so a reply
that lands before the binding exists is lost to it.

```json
engine::register_trigger {
  "trigger_type": "state",
  "config": { "scope": "work:search-filters-api", "key": "to:backend-engineer" },
  "label": "search-filters-api-to-backend-engineer",
  "metadata": { "action": "message on search-filters-api for backend-engineer" },
  "lifecycle": { "expires_in_ms": 86400000 }
}
```

- A wake is **once** by default: it parks the session until the key is
  written, then retires. That is the shape you want. Re-arm it on every wake
  (below), so each armed wake is fresh.
- `expires_in_ms` is the backstop. A wake that expires unfired injects a
  `[notification]` into your session naming the watch, so silence has a
  deadline. On that notice, re-read the item: re-arm if it is still open, stop
  if it is `done`.
- `label` is `<item-id>-to-<role>`, so `harness::triggers::list {}` reads like
  an inventory and teardown is mechanical.
- The response is `{ subscription_id, once, note }`. Keep `subscription_id`;
  `harness::triggers::unregister { "subscription_id": "…" }` retires a wake
  you no longer need. (`engine::unregister_trigger` is denied to spawned
  children; the `harness::triggers::*` pair is not.)

The payload on fire is `{ type: "state", event_type, scope, key, old_value,
new_value }`, where `new_value` is the whole `to:<role>` document. Read the
item record anyway: the message says someone wrote, the record says where the
item stands.

### On every wake, in this order

1. **Re-arm first**, with the registration above. A message that lands while
   you are working then wakes you again after this turn instead of vanishing.
2. **Read** `state::get { "scope": "work", "key": "<id>" }` and your
   `to:<you>` thread. Act on every message after the last one you handled,
   not just the newest.
3. **Answer on the item**: a merge on the record, an append to the other
   role's key, or both.
4. **If `status` is `done`**, `harness::triggers::unregister` the wake you
   armed in step 1 and stop. Nothing else needs reaping; a fired once-wake is
   already gone.

## Reading the board

`state::list { "scope": "work" }` returns every item with its full
description. Read it once per planning pass, never on a wake; the wake already
names its item. On a large index, `state::list_keys { "scope": "work" }` then
`state::get` only what you are about to touch.

## Finishing: review or done, never delete

An agent never deletes an item; `state::delete` is a human's action, from the
console's state page. Finish by moving it:

- **Needs a check** → merge `{ "status": "in_review" }` and append a `report`
  to `to:<reviewer>`. Anything user-visible, anything that changes shared
  state or someone else's work, and anything whose description says a review
  is expected.
- **Finished and verified by you** → merge `{ "status": "done" }`, only when
  the item's own `Verify:` targets passed and you observed them. Never `done`
  on the strength of having written something.

Unsure → `in_review`, and say why in the report; a reviewer can always move it
on.

## Checklist

- Ids are slugs; `state::get` before the creating `state::set`.
- Every write after creation is `state::update` with `merge`, carrying
  `updated_by`.
- Messages are appended to `work:<id>` / `to:<role>`; you never write
  `to:<your own id>`.
- The wake is armed before the write that invites the answer, labelled
  `<id>-to-<you>`, with `expires_in_ms`.
- On a wake: re-arm, read, act, unregister on `done`.
- Read the board once per planning pass, never on a wake.
- Finish by merging `status`; never `state::delete`.
