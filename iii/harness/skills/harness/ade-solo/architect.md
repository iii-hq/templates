---
name: ade-solo-architect
type: how-to
description: >-
  Turn a confirmed ADE tool spec into one worker architecture (identity,
  granular contracts, reactive events, data homes, console surface, delivery
  and the check plan) before any code, in a single-agent build.
---

# Architect (Tech Lead hat)

Read `harness/iii-node/architecture` whole (about 4 KB): it is the
constraint set. Its engineer and dispatch ownership rules become your phase
order: backend and delivery before UI, and only the affected build phases
for an existing tool. Open no scaffold or UI manual in this phase; if one
unresolved question changes the architecture, read only the section that
answers it.

## First move

Read the spec, its `Project context` and any existing `## Architecture`.
Refresh the affected runtime: `engine::functions::list` for each affected
prefix and `engine::functions::info` for the selected ids. Check registered
capabilities, and `directory::registry::workers::list` for a genuinely new
one, before claiming it. Inspect only affected code, package and compose
entries. Record new facts and their sources in `Project context`.

## The architecture

Create or update exactly one `## Architecture` section in the spec. Keep it
current instead of appending a new one on each correction. It names:

- **Identity.** `<worker-name>`, the worker directory, the env prefix, the
  configuration id and the page id.
- **Functions, granular.** Every id with its request schema, response
  schema and failure shape. One action per function, small input, small
  output, `<worker-name>::<resource>::<action>`; the screen composes them.
  A function that does three things is three functions.
- **Events, reactive.** The worker's own trigger type
  (`<worker-name>:change`): what it emits and when, emitted after
  persistence, carrying the whole record so a consumer upserts without a
  round trip, and forwarding subscription metadata. What the worker itself
  binds to (`configuration`, `cron`, `state`, another worker's type).
  Nothing polls.
- **Data, one home per fact.** Engine `state` for small values others
  watch, the `database` worker for records, the `configuration` worker for
  operator values. Never two homes for one fact.
- **Console surface.** Pages, renderers and the configuration form; the
  archetype; which functions each calls; which events it subscribes to.
- **Delivery.** Package path, current build and dev status, and any missing
  prerequisite.
- **Phases and checks.** Which build phases run, the files each one
  touches, the checks each one runs, what the Accept run covers, the
  evidence path, and the dependencies between checks.

## Gate

Before leaving, answer both: can the Backend phase implement every function
without making a decision, and can the Frontend phase build every surface
against named ids and events? If either answer is no, the architecture is
not done.

Then set `Architect: done <when> · harness/ade-solo/architect` in
`Progress`, point `Next:` at the first build phase, and fetch its playbook.
Later, when an implementation does not fit, come back here: change the
architecture first and record why in `Notes`. Never shrink the scope to fit
what passed.
