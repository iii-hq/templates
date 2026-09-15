---
name: orchestration
type: how-to
description: >-
  Run sub-agents from a session: brief each one with `harness::spawn`
  (downstream), receive its result through the `state` key its brief named
  (upstream), verify before accepting, and answer by spawning into the same
  session again. The child never needs to know you exist.
---

# Orchestrating sub-agents

Two wires, one direction each.

- **Downstream is `harness::spawn`.** The `task` you pass is the child's
  whole brief. It arrives knowing only its own identity and that text;
  anything you leave out, it invents.
- **Upstream is `state`.** The brief names one state key; the child writes
  its result there when it finishes. You armed a `state` wake on that key
  before spawning, so the write starts your next turn with the result in it.

The child does not look for a parent, does not wait for you, and arms nothing
for you. It reads its brief, does the work, writes the key it was given, and
stops. Every answer you want to give it is another `harness::spawn` into the
same `session_id`. The child's half of this is the `report` skill
(`harness/orchestration/report`), which every profile you dispatch preloads.
An ad hoc child without a profile must read that skill as its brief directs;
the communication protocol is the same.

## Before the first spawn

- `engine::functions::info { "function_ids": ["harness::spawn", "engine::register_trigger"] }`
  once; `task`, `agent`, `session_id`, `display`, `options.orchestrator` and
  the return shape are what matter.
- Inspect a selected profile with `directory::agents::get` only when its
  ownership, skills or functions are unknown or changed. A known dispatch
  contract in your role or project plan is sufficient; do not reload child
  profiles on every hand-off. For an ad hoc child, skip the profile lookup:
  give it an explicit `options.system_prompt` and a brief
  that tells it to read `harness/orchestration/report` through
  `directory::skills::get`. `options.skills` only filters the skill index;
  it does not preload skill bodies.
- Anything long-lived (a spec, an architecture, a plan) goes to a file in
  the project before the spawn, and the brief names its path. Your chat is
  gone when your session ends; a file survives, and the user can read and
  edit it.

## One dispatch, in order

Choose the child's `session_id`: a readable slug plus a short random suffix,
`issue-board-backend-7f3a`. Its result key is that same slug in scope
`results`, so one identifier names the session, the wake and the result.

1. **Arm the wake.** No `function_id`; the empty target is what makes it a
   wake into your own session (any `harness::*` target is refused).

   ```json
   engine::register_trigger {
     "trigger_type": "state",
     "config": { "scope": "results", "key": "issue-board-backend-7f3a" },
     "label": "issue-board-backend-7f3a",
     "metadata": { "action": "result from issue-board-backend-7f3a" },
     "lifecycle": { "expires_in_ms": 7200000 }
   }
   ```

   A wake is once by default: it parks you until the key is written, fires,
   and retires. `expires_in_ms` is the backstop for a child that never
   writes: the expiry lands as a `[notification]`, and
   `harness::status { "session_id": "<child>" }` says whether the child is
   still running. Re-arm and wait, or re-spawn with a sharper brief.

2. **Spawn.**

   ```json
   harness::spawn {
     "agent": "backend-engineer",
     "session_id": "issue-board-backend-7f3a",
     "display": { "name": "Backend · issue-board", "icon": "terminal", "color": "blue" },
     "task": "<the brief, below>"
   }
   ```

   - When supplied, `agent` is a profile id from `directory::agents::list`,
     never a display name. For an ad hoc child, omit `agent` and supply
     `options.system_prompt`; omit both and the child inherits your profile.
     Never combine `agent` with `options.system_prompt`. Use
     `options.system_prompt_strategy: "override"` when that prompt should
     be the child's whole identity instead of enriching the default.
   - `options: { "orchestrator": true }` only for a child that must spawn
     children of its own. Everything else is a leaf: it may arm a wake for
     its own work, and cannot spawn, send, or unregister anything.
   - Omit `options.functions` and the child inherits your policy. Pass
     `options.functions.allow` only to narrow it, and then list every id
     the child's work needs, one per entry, no wildcards. A profile's
     `functions` list preloads contracts; it is not a permission policy.
     Never turn a coordinator's shorter preload list into its child's allow list.
   - It returns `{ child_session_id, child_turn_id, reused }` at once. That
     means the child started, nothing about it finishing.

3. **Stop.** End the turn. The wake brings you back.

Independent children go out in one turn: a wake and a spawn per child, then
stop. Children whose work overlaps go out in sequence, the next one after the
previous result was verified.

## The brief

Name everything literally: the child cannot infer a path, a function id, a
convention, or who else is working on the feature.

```text
You are building <the deliverable, in one sentence>.

Read <path to the spec or architecture file> first; it is the contract.
Project root: <absolute path>. Worker directory: <path>.

Build: <what, in the child's own terms>.
Out of scope: <what a reader would assume is included and is not>.

Done means (child checks):
1. <observable check a stranger can run: a function call with its payload,
   a command, a URL, a screen>
2. ...

Parent checks, performed after this result:
1. <independent acceptance or integration check the dispatcher owns>

Detailed evidence: <project file path; record check ids, inputs, observations
and the tested version/hash or runtime time there; cite it in the report>.

When finished, write your result with state::set to scope "results", key
"issue-board-backend-7f3a", as the report skill describes, then stop. If you
are blocked, write outcome "blocked" with the question, then stop.
```

Out of scope is the cheapest line in the brief: it is what stops a child
inventing work.

Use paths and sections for plans, project context and prior evidence; do not
paste those documents into the task. A correction names the changed scope,
failed check, expected/observed result and dependencies to recheck. Preserve
the child's profile or ad hoc prompt/options when reusing its session.

## Reference checks

For a concrete unanswered question, dispatch an ad hoc read-only leaf with
its own `options.system_prompt` and `system_prompt_strategy: "override"`.
Name the question, project root, at most three source ids/paths and relevant
sections, plus scope `results` and the session's result key. Tell it to read
`harness/orchestration/report`, consult only those sources, and return at
most 300 words with findings and source locations. No edits, user interview
or further children. Allow the required reads and `state::set`. Use the same
wake/spawn/state protocol. Do not fan out entire manuals or catalogs; reuse
findings until the question or sources change.

## On the wake

The event is `{ type: "state", event_type, scope, key, old_value, new_value }`;
`new_value` is the child's result document: `outcome`, `summary`,
`evidence`, `files`, `questions`.

1. **Verify before you accept.** Review evidence for every assigned child
   check: inputs, observations, source location and the tested code/runtime.
   Run the parent checks yourself. An explicit split must include independent
   verification of the deliverable or its integration; it does not permit
   accepting only a summary. When the brief has no verification split, run
   its checks yourself. Missing, stale or contradictory evidence needs a
   targeted reproduction or a correction; it cannot pass by omission.
2. **Accept**: dispatch the next child, or, if you were spawned yourself,
   write your own result upstream.
3. **Send back**: re-arm the wake on the same key (step 1 above), then
   `harness::spawn` again with the same `session_id` and a brief naming the
   gap: what you expected, what you observed, what would make it pass. The
   child continues with its transcript intact (`reused: true`).
4. **Blocked with a question**: answer it the same way, a spawn into the
   same session with the answer in the brief.

`state::get` the key before acting on a late or duplicated fire; the child
may have written again since.

After corrections, recheck changed behavior and dependent checks. Preserve
earlier evidence only while its code, contracts and runtime still apply;
record why it remains applicable and broaden checks when impact is unclear.
Do not replay an engineer's full test matrix at every orchestration level.

## Fan-in

- N children are N wakes and N keys. Never watch scope `results` without a
  key: another orchestrator's children write there too.
- `state::list { "scope": "results" }` shows which results have landed.
- `harness::status { "session_id": "<child>" }` is one child's current
  turn; a child that wrote its result has stopped.
- `harness::triggers::list {}` audits what you still have armed. A fired
  wake is already gone; `harness::triggers::unregister { "subscription_id" }`
  retires one you no longer need.

## Traps

- **The child says done and the feature does not work.** You accepted a
  summary. Review the evidence and run the independent parent checks.
- **Two children editing one file.** Parallel children have no merge
  protocol. If both would touch `package.json`, the build script or one
  shared module, dispatch them in sequence.
- **A consumer dispatched before its contract exists.** The frontend
  invents `board::move { cell }` while the backend registers
  `board::play { row, col }`. The child that owns a function id's schema
  finishes before the child that calls it starts.
- **The wake armed after the spawn.** A fast child writes before the
  binding exists and the event is lost. Arm first, always.
- **A tiny `options.max_turns`** strands a child mid-task with nothing
  written. Omit it.
- **You wrote the implementation yourself.** Reaching for the keyboard
  means the brief was underspecified. Fix the brief, re-spawn, say why.

## Checklist

- [ ] Spec or plan written to a file the brief names by path.
- [ ] Per child: wake armed on `results` / `<session_id>` with
      `expires_in_ms`, then the spawn, then stop.
- [ ] The brief names the deliverable, the paths, the scope, the out of
      scope, the checks, and the result key.
- [ ] `options.orchestrator: true` only on a child that spawns.
- [ ] Child evidence reviewed and independent parent checks observed before
      acceptance; unassigned verification splits default to checking the brief.
- [ ] Feedback goes down as a spawn into the same `session_id`, after
      re-arming the wake.
- [ ] Every child stopped (`harness::status`) before you call the fan-out
      finished.
