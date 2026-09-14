---
title: dispatch
type: how-to
description: >-
  Dispatch one feature across several agent profiles as work items in state:
  split on the seam, arm a wake per item, spawn one child per item with a
  self-contained task and a full allow list, and stay reachable until the seam
  is verified.
---

# Dispatching a feature across agent profiles

You are the one who splits a feature across other profiles. State is the only
wire between you and them. Everything below exists to keep that wire honest.

## Open these before you dispatch

- **The dispatch contract**: `engine::functions::info { "function_ids":
  ["harness::spawn"] }`. Read `task`, `agent`, `options.functions`, and the
  return shape before spawning anything.
- **The roster you dispatch into**: `directory::agents::get { "id":
  "<owner>", "raw": true }`. The `skills:` and `functions:` lists are what
  that child actually starts with, and therefore what it does *not* know.
- **The board**: `state::list { "scope": "work" }` once per planning pass,
  not per wake. If a Product Manager already planned the feature, its item is
  the `parent` of everything you create.
- **The mechanics**: the `work-items` skill: slugs, `merge`, `to:<role>`
  messages, the wake. The child's half of the same loop is the `worker-loop`
  skill, which the engineer profiles preload.

## State is the only channel

There is no `harness::send` between agents (confirm with
`engine::functions::list { "prefix": "harness::" }`). Combined with the spawn
contract, that leaves exactly one wire:

1. **The task text is the child's whole brief.** It cannot infer a path, a
   function id, a convention, or who else is working on the feature. Name
   them literally or it guesses.
2. **The destination is the item.** A `report` on `to:tech-lead` is how the
   child reports; `in_review` is what it believes it achieved. Neither is
   proof; see *Your gate*.
3. **Your answer goes back on the same item**, to `to:<owner>`. A decision
   you keep in your own session never reaches the engineer.
4. **The return leg has to exist.** The child only hears your answer if it
   armed a wake on `to:<its own id>` for its item. Nothing you do in your
   session can arm that for it; name the duty in the task.

## Split on the seam, not on the layer

The failure this role exists to prevent is an item pair that both pass and
still do not work together. Prevent it structurally:

- **Contract first.** Exactly one item owns each new function id's *schema*
  (the id, the request fields, the response fields), and it must be `done`
  before the item that calls it starts. Give the consumer item
  `depends_on: ["<contract-id>"]` and do not dispatch it early.
- **One owner per item.** An item with two owners has no owner. Work needing
  both is two items.
- **Split by outcome.** Each item must be verifiable alone, by someone who
  did not write it.
- **Say what is out of scope.** The cheapest way to stop a child inventing
  work.

Symptom of skipping the contract item: the frontend registers `game::move`
with `{ cell }` while the backend registered `game::play` with `{ row, col }`.
Two green items, one broken feature.

## The item you create

```json
state::get { "scope": "work", "key": "search-filters-api" }      // must be null
```

```json
state::set {
  "scope": "work",
  "key": "search-filters-api",
  "value": {
    "id": "search-filters-api",
    "title": "search::filters::list registered and verified",
    "status": "todo",
    "owner": "backend-engineer",
    "reviewer": "tech-lead",
    "priority": "high",
    "parent": "search-filters",
    "depends_on": [],
    "description": "Deliverable: <the one thing this item produces>\nOwner: backend-engineer\nDepends on: <item ids + the function ids that must already resolve>\nAcceptance:\n1. <observable statement>\n   Verify: <a command, a url, or a screen; something a stranger can run>\n2. ...\nOut of scope: <what a reader would reasonably assume is included and is not>",
    "created_by": "tech-lead",
    "updated_by": "tech-lead"
  }
}
```

A criterion with no `Verify:` line is not a criterion, it is a wish, and it
comes back to you as a caveat you cannot adjudicate. Owners are profile ids:
the browser application is `frontend-engineer`; workers, functions and
contracts are `backend-engineer`; the pages, renderers, configuration forms
and styles a worker injects into the ADE console are `ade-worker-designer`. A
console page and the worker functions it calls are two items, the contract
item first.

## Arm the wake, then spawn

One wake per item, **before** the spawn. The child's first report could land
before your next turn otherwise.

```json
engine::register_trigger {
  "trigger_type": "state",
  "config": { "scope": "work:search-filters-api", "key": "to:tech-lead" },
  "label": "search-filters-api-to-tech-lead",
  "metadata": { "action": "message on search-filters-api for tech-lead" },
  "lifecycle": { "expires_in_ms": 86400000 }
}
```

Then dispatch:

```json
harness::spawn {
  "agent": "backend-engineer",
  "session_id": "search-filters-api-backend",
  "display": { "name": "Backend · search-filters-api", "icon": "terminal", "color": "blue" },
  "options": { "functions": { "allow": ["state::get", "state::update", "engine::register_trigger", "harness::triggers::list", "harness::triggers::unregister", "coder::read-file", "coder::create-file", "coder::update-file", "coder::search", "coder::tree", "coder::list-folder", "shell::exec", "browser::fetch"] } },
  "task": "You own work item `search-filters-api` (state scope `work`, key `search-filters-api`); work it with the worker-loop skill. Your profile id is backend-engineer; the reviewer is tech-lead. Read the item with state::get { \"scope\": \"work\", \"key\": \"search-filters-api\" }, then claim it: state::update on that scope/key with ops [{ \"type\": \"merge\", \"value\": { \"status\": \"in_progress\", \"owner\": \"backend-engineer\", \"updated_by\": \"backend-engineer\" } }]. Before you report, arm your wake: engine::register_trigger { \"trigger_type\": \"state\", \"config\": { \"scope\": \"work:search-filters-api\", \"key\": \"to:backend-engineer\" }, \"label\": \"search-filters-api-to-backend-engineer\", \"lifecycle\": { \"expires_in_ms\": 86400000 } }. Do the work in <path>. The function ids to register are <ids and schemas>. When finished, report with state::update { \"scope\": \"work:search-filters-api\", \"key\": \"to:tech-lead\", \"ops\": [{ \"type\": \"append\", \"path\": \"messages\", \"value\": { \"from\": \"backend-engineer\", \"kind\": \"report\", \"body\": \"<exactly what you ran and what it returned>\" } }] }, then merge { \"status\": \"in_review\", \"updated_by\": \"backend-engineer\" } on the item. On a wake, re-arm first, read the item and to:backend-engineer, answer on the item. Stop when the item's status is done. Never state::delete anything."
}
```

- `agent` is a profile id from `directory::agents::list`, never a display
  name.
- One fresh `session_id` per item: the console tree stays legible, and the
  child cannot inherit another item's context.
- The task names the item id, the exact claim/report/hand-off calls, the
  arm-before-report duty, and the stop condition. Assume the child arrives
  knowing nothing but its own profile.
- **Preloading is not permission.** `options.functions` is the fail-closed
  dispatch policy, intersected with your own and never escalating; absent,
  every call is denied. Pass `options.functions.allow` with the ids the child
  needs, one per entry, no wildcard: `state::get`, `state::update`,
  `engine::register_trigger`, `harness::triggers::list`,
  `harness::triggers::unregister`, and its own toolchain. Spawned children
  are leaves: they cannot `harness::spawn`, and `engine::unregister_trigger`
  is denied to them, which is why the teardown call is
  `harness::triggers::unregister`. Drop `engine::register_trigger` and the
  child cannot arm its wake; every answer you post reaches nobody.
- `harness::spawn` returns `{ child_session_id, child_turn_id }` immediately.
  That means the child *started*. It never means the child finished.

## Stay reachable

- Your wake per item is on `to:tech-lead`; `exclude_author` does not exist
  and is not needed, because you never write that key.
- On every wake: **re-arm first**, then `state::get` the item and
  `state::get { "scope": "work:<id>", "key": "to:tech-lead" }`, decide,
  answer on the item. Not the board; the wake already told you which item
  moved. Re-read the record before acting: a late or re-armed fire can
  deliver a message for work that already closed.
- `harness::triggers::list {}` audits what is actually armed. Labels are
  `<id>-to-tech-lead`, so the inventory reads by item.
- The expiry notice is your backstop for a child that goes silent. On it,
  `harness::status { "session_id": "<child>" }` answers whether it is still
  running; re-arm or re-dispatch.
- N items need N wakes; the cap is 64 live bindings per session.

## Your gate

An item in `in_review` gets the `review` skill: every criterion a verdict of
**met**, **not met**, or **cannot verify**, backed by something you observed
yourself. Any caveat is a not-met: `review` message to `to:<owner>`, then
merge `in_progress`. Your verdict is about the **contract and the seam**. It
is not the Product Manager's check on the user's outcome; when every child of
a parent is `done` and the seam was exercised in one run, report on the
parent to `to:<parent.reviewer>` and merge the parent to `in_review`. Do not
move the parent to `done` on their behalf.

## Fan-in: knowing the children actually stopped

```json
harness::metrics { "root_session_id": "<your session id>" }
```

`complete` is true only once every session in your durable tree reached a
terminal turn. That is the "all my children are done" signal, not a guess,
not a timeout. `harness::status { "session_id": "<child>" }` is one child's
current turn.

## Traps

- **The child reports success and the feature does not work.** Each item was
  checked against its own contract, not against the seam. Someone must
  exercise caller and callee together; that evidence goes on the parent item.
- **A spawned engineer answers "I cannot call any function."** The dispatch
  policy on the spawn was fail-closed. Pass `options.functions` explicitly.
- **The child reports and your answer wakes nobody.** The child never armed a
  wake on its item. Cause: the task named the claim and the hand-off but not
  the arm-before-report duty. Fix: say it in the task, and check the reply
  flow on a first small item before trusting the pattern.
- **You dispatched against a stale dependency.** The upstream function id or
  schema changed while the consumer item waited. Re-read the upstream item
  immediately before dispatching the consumer.
- **Two items editing one file.** Parallel children have no merge protocol
  here. If the split has both touching `package.json`, the route tree, or
  one shared module, it is one item.
- **You rewrote another profile's report.** Append as yourself; never edit
  what a child wrote.
- **A child spawned with a tiny `options.max_turns` strands mid-task** and
  reports nothing. Omit it unless you have a reason.

## Checklist

- [ ] Every item names one owner, one deliverable, its dependency by id, and
      criteria with literal `Verify:` targets.
- [ ] The schema-owning item is `done` before any consumer item is dispatched.
- [ ] Each child's task names the item id, the claim/report/hand-off calls,
      the arm-before-report duty, and the stop condition, with no reference
      to anything only you can see.
- [ ] The spawn carries `options.functions.allow` with the ids the child
      actually needs, named explicitly.
- [ ] A wake on `to:tech-lead` armed per item before its spawn, labelled
      `<id>-to-tech-lead`, with `expires_in_ms`.
- [ ] On every wake: re-arm, read, decide, answer on the item; unregister on
      `done`.
- [ ] `harness::metrics { root_session_id }` reports `complete: true` before
      you claim the fan-out finished.
- [ ] The seam was exercised end to end and the evidence is on the parent
      item, not in your summary.
