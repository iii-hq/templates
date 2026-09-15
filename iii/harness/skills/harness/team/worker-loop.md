---
title: worker-loop
type: how-to
description: >-
  Work a work item you were dispatched onto: claim it in state, arm your own
  wake before reporting, report on the item to its reviewer, and stop the
  moment the item is done.
---

# Working an item you own

You were dispatched onto a work item by someone who cannot talk to you: there
is no `harness::send` between agents. Every instruction you get arrived in
your task or as a message on the item, and every answer you give has to land
on the item. Your chat is not a channel.

## Open these first

- `state::get { "scope": "work", "key": "<item-id>" }` — the item you were
  dispatched onto, whole, before you change anything. Its `reviewer` is the
  role you report to; its `description` holds the criteria you build to.
- `state::list { "scope": "work:<item-id>" }` — every message already on the
  item, yours included.
- `engine::functions::info { "function_ids": ["state::get", "state::update",
  "engine::register_trigger", "harness::triggers::list",
  "harness::triggers::unregister"] }` — the exact schemas behind every call
  below.
- `directory::skills::get { "id": "harness/team/work-items" }` — the deep
  reference: the layout, `merge` vs `set`, the message kinds. Fetch it when
  you need it; skip it otherwise.

## The loop

Your profile id is the string in your frontmatter (`backend-engineer`,
`frontend-engineer`, `ade-worker-designer`). Use it verbatim as `updated_by`
on every merge and `from` on every message; it is also the key your wake
watches (`to:<your id>`), so a typo silently breaks the loop.

1. **Claim.**
   ```json
   state::update {
     "scope": "work", "key": "<item-id>",
     "ops": [ { "type": "merge", "value": { "status": "in_progress", "owner": "<your id>", "updated_by": "<your id>" } } ]
   }
   ```
2. **Arm your wake, before you report.** See *The wake* below. Reporting
   first is the failure this step exists to prevent: the reviewer's answer
   arrives after your turn ended and wakes nobody.
3. **Work**, then verify it the way your own profile requires.
4. **Report on the item** to its `reviewer`, with the calls you made and what
   they returned. A summary in your chat is invisible to the reviewer.
   ```json
   state::update {
     "scope": "work:<item-id>", "key": "to:<reviewer>",
     "ops": [ { "type": "append", "path": "messages", "value": { "from": "<your id>", "kind": "report", "body": "<files changed, gates run, calls made and their results, evidence>" } } ]
   }
   ```
5. **Hand off**: merge `{ "status": "in_review", "updated_by": "<your id>" }`
   when someone else must check it; `done` only when the item's own `Verify:`
   targets passed and you observed them.
6. **On a wake** (a review, a rejection, a question): re-arm first, then
   re-read the item and your `to:<your id>` thread; a late fire can deliver
   a message for work that already closed. Answer on the item: a `question`
   gets an `answer` on `to:<reviewer>`; a rejection gets the work, then a new
   `report` and `in_review` again.
7. **When `status` is `done`**: `harness::triggers::unregister` the wake you
   re-armed, and stop.

## The wake

```json
engine::register_trigger {
  "trigger_type": "state",
  "config": { "scope": "work:<item-id>", "key": "to:<your id>" },
  "label": "<item-id>-to-<your id>",
  "metadata": { "action": "message on <item-id> for <your id>" },
  "lifecycle": { "expires_in_ms": 86400000 }
}
```

- The key must equal your profile id character for character; the reviewer
  addresses you with the record's `owner` string, which you wrote in step 1.
- A wake is once: it parks your session until that key is written, then
  retires. Re-arm as the **first act** of every wake, so a message that
  lands while you work wakes you again instead of vanishing.
- You never wake on your own writes: your reports go to `to:<reviewer>` and
  to the record, neither of which you watch.
- The response's `subscription_id` is what `harness::triggers::unregister`
  takes; `harness::triggers::list {}` shows it under your label.
  `engine::unregister_trigger` is denied to spawned children; use the
  `harness::triggers::*` pair.

## The backstop: a wake has a deadline

`expires_in_ms` is not decoration. A wake that expires unfired injects a
`[notification]` into your session naming the watch, so a reviewer who never
answers cannot leave you parked forever. On that notice: re-read the item; if
it is still open and assigned to you, re-arm and, if you are waiting on a
review, say so with a `note` to `to:<reviewer>`; if it is `done`, stop.

## Traps

- **The reviewer rejects and nothing happens.** Your turn had already ended
  and no wake was armed. Cause: you reported before arming. Fix: arm first,
  report second.
- **Your own report wakes you.** You watched `to:<reviewer>` or appended to
  `to:<your id>`. Fix: write to the reviewer's key, watch your own.
- **A wake fires for a closed item.** A late or duplicated fire. Fix: re-read
  the record and no-op unless it is still open and assigned to you.
- **A `[notification]` weeks later on a `done` item.** You re-armed on the
  accepting wake and never unregistered. Fix: step 7.
- **The item sits in `in_progress` and nobody answers.** Cause: your report
  was a chat message, or went to `to:Tech Lead`. Fix: append to
  `to:<reviewer>` using the record's `reviewer` string, every time.
- **You reached for a function that does not exist.** There is no
  `harness::send`; the wire is the item. Fix: `engine::functions::list` /
  `directory::search_functions` before naming an id.
- **You `state::set` the record.** `owner`, `parent`, `depends_on` gone. Fix:
  `merge`, always.

## Checklist

- [ ] Item read whole (record and every thread) before any write.
- [ ] Claimed with a merge of `status`, `owner` and `updated_by`, all your
      profile id where a role is named.
- [ ] Wake armed on `to:<your id>`, labelled `<item-id>-to-<your id>`, with
      `expires_in_ms`, before the first report.
- [ ] Report appended to `to:<reviewer>` naming what you ran and what it
      returned.
- [ ] Status merged to the lane the evidence earned.
- [ ] On a wake: re-arm, re-read, answer on the item.
- [ ] On `done`: the re-armed wake unregistered, then stop.
