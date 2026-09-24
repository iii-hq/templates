---
name: ade-solo-plan
type: how-to
description: >-
  Plan an ADE tool as the Builder of a single-agent build: reach a confirmed
  plan in product language and write the spec every later phase works from.
---

# Plan (Builder hat)

`ade-worker-planning` is preloaded beside this playbook: it supplies the
surface choices and the acceptance rules. Load no implementation manual in
this phase. If one unresolved choice would change the spec, read only the
section that answers it (headings first, then a window) and record the
answer and its source in `Project context`.

## Project facts before questions

Read applicable project instructions and only the relevant README, compose
entries and files. Before claiming a new capability, check what already
runs: `engine::workers::list`, `engine::functions::list` with a `prefix`,
and for an existing tool its `console::ui-manifest` entries. Never ask the
user what the project or the engine can answer.

Record reusable findings in `Project context`: source paths and sections,
existing capabilities, where the skill files live, the ADE URL and how you
found it (the `http_port` of `configuration::get { "id": "default-ade" }`,
or the ADE entry `configuration::list` shows; never a guessed port or a
socket scan), versions or hashes, and when runtime facts were checked. On
later turns investigate only gaps or changed facts.

## The conversation

Talk about the user's problem and the behaviour they want. They must be able
to finish without knowing function ids, trigger types, phases or storage
architecture.

- **Clear request:** do not interview. Summarize what you understood in a
  few lines and go straight to the plan.
- **Needs clarification:** state the outcome you aim for in one sentence,
  then ask at most one or two questions per turn, only those whose answers
  change what gets built.
- **Vague request:** offer a concrete starting point, for example a small
  task list, instead of a questionnaire.
- Explain a technical term only when the user must decide something that
  depends on it, and then in one sentence.
- "Just write it": answer the open points yourself, mark each `Assumed:` in
  the spec and say the assumptions out loud.

Internal checklist, not a questionnaire. One sentence per item becomes the
spec; fill it from the request, the project and the engine, and ask only
what stays genuinely open:

1. Who uses this in the ADE, and what do they do today instead?
2. The primary object and where it lives: engine state, the database
   worker, files, an external API. Prefer a capability the project already
   runs.
3. What the user sees and does: the slot and the archetype. You choose;
   describe it as what they will see.
4. Which functions must exist (`<worker>::<resource>::<action>`, what goes
   in, what comes out) and which changes the screen shows live. You decide
   these; never ask the user to name functions.
5. What the operator configures.
6. What is explicitly not in this slice.
7. How a person checks it works in the ADE without reading the diff.

## The plan

Present it in product language first: what the tool lets the user do, where
it appears in the ADE, what survives a page refresh, what is out of scope,
and the acceptance checks as a short numbered list of things the user will
see. Then write the spec and point to it for the technical detail.

Anything the project does not already have (a new package, an external
service, an account or a credential) is named in the plan with a one-line
reason and needs agreement before it is added.

**Stop for confirmation.** Nothing is built before the user confirms. For a
delta on an existing tool, confirm whenever user-visible behaviour changes;
a defect that restores an existing criterion needs no new confirmation.

The only exception is a non-interactive run: the request itself says no
person will answer (an automated or harness-driven run, or a task another
agent spawned) and it fully specifies the tool. Write the spec, set
`Plan: assumed-confirmed (non-interactive)`, mark your decisions
`Assumed:` in `Notes`, and go on through every later phase, Accept
included. A request being detailed does not make it non-interactive: a
person in chat still confirms.

## The spec

Write `specs/<worker-name>.md` at the project root, or wherever the project
already keeps specs. Headings verbatim, in this order:

```markdown
# <worker-name>

## Problem
<who is hurt today, and how>

## Outcome
<what is true after this ships, from the user's side>

## Users and the primary object
<who, the record, where it lives>

## Console surface
<slot(s), archetype, the wide and the narrow flow, the five states:
loading, empty, error, success, overflow>

## Functions
- `<worker-name>::<resource>::<action>` — <request>, <response>, <failure modes>

## Live updates
<which changes the screen reflects without a reload, and from which events>

## Configuration
<operator-facing values, with defaults>

## Acceptance criteria
1. <actor> <action> → <observable result>. Verify: <a function call with its
   payload, a URL in the console, a screen>.

## Out of scope
- <what a reasonable reader would assume is included, and is not>

## Project context
- <observed fact, source path/section or runtime call, version/hash or time>

## Architecture
<written in the Architect phase>

## Progress
- Class: <new tool | behaviour change | UI-only | service-only | defect>
- Plan: <status> · Architect: <status> · Backend: <status> · Frontend: <status> · Accept: <status>
- Next: <the one concrete next step>
- Evidence: `specs/<worker-name>.evidence.md`

## Notes
- Assumed: <anything decided without confirmation>
```

A status is `pending`, `done <when> · <playbook id>`, `skipped (<reason>)`
or `failed: <criterion or check>`; the Plan line may also be
`assumed-confirmed (non-interactive)`. `done` is valid only after that
phase's playbook was fetched in this session and its gate checks ran.

- **Criteria are observable or they are not criteria.** Numbered, each with
  a `Verify:` line. "The board updates correctly" is not a criterion; "an
  operator drags a card to Done and the card is in Done after a reload" is.
- **Three to seven criteria.** More is two workers, or two slices.
- **Behaviour, not implementation**, in every section above
  `## Architecture`. `Project context` records existing paths and facts, not
  a proposed implementation.
- **Edit the file in the same turn a decision changes**, say in prose what
  changed, and stop for confirmation again.

On confirmation set `Plan: done <when> · harness/ade-solo/plan` and `Next:`
to the first phase the class runs, then fetch that phase's playbook.
