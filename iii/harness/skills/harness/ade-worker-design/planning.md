---
name: ade-worker-planning
description: >-
  Plan an ADE worker's console surface and user acceptance criteria. For
  product planning; implementation recipes belong to the engineers.
---

# Planning an ADE worker

The ADE console hosts worker UI at runtime. A worker owns its data and
functions; the console hosts its pages, renderers and configuration forms.
Plan the user outcome and the surface needed to reach it.

## Choose the surface

| User need | Surface |
| --- | --- |
| Browse or act on a collection | A worker page |
| Inspect one record | A record screen opened in its own pane |
| Understand a function call in chat | A function renderer |
| Inspect a trigger event | A trigger-activity renderer |
| Change operator settings | A configuration form |

Within a page, use a board for status lanes, a catalog for comparable
records, an explorer for hierarchy, or a record screen for one object and
its history. A creation modal handles a short creation task; a record's
detail view is a screen. Add only the surfaces the requested flow needs.

## Decisions the spec must settle

- Name the actor, primary object, current problem and observable outcome.
- Describe the main action, navigation and what survives a reload.
- Account for phone, narrow split and wide panes, both themes, keyboard
  access, and loading, empty, error, success and overflow states.
- Name the public actions, their inputs, results and user-visible failures.
  Exact schemas and implementation paths belong to the architecture.
- Say which changes appear live and what operators can configure. Operator
  values live in the configuration worker; secrets never appear in public
  defaults. Expose settings only when the corresponding form exists.
- Keep the interface native to the console's shared components and scoped
  styles. Engineers resolve current component APIs and design tokens.

## Acceptance

Give each criterion a stable id and a reproducible `Verify:` action in the
running console: a page criterion may name the page alone
(`#/worker/<scope>[/<page-id>]`, the worker's asset namespace and page id);
a link that opens another of the worker's pages is checked there too; only
chat renderers, session chips and palette rows need the full console.
Describe the expected persisted or visible result. Include
a failure or recovery path when it changes whether the feature is usable.
For live data, mutate outside the page and observe the open page update.

Each criterion is observed once in the running console by running its
`Verify:`; an observation recorded during the build counts at acceptance
while the assets, code and contracts it depends on are unchanged. Engineers
own the implementation test matrix and the Tech Lead the contract and
integration checks; acceptance references their evidence without replaying
it.

## Consult only for a decision

This reference is sufficient for ordinary planning. Do not load the full
design manuals as preparation. If an unresolved choice would change the
spec, read only the section that answers it yourself: list the manual's
headings, then read that window. `harness/ade-worker-design/patterns`
answers interaction questions;
`harness/ade-worker-design/console-injectable-ui` answers host-capability
questions. Consult `console-design` in that same skill namespace only for a
specific visual constraint. Record the answer and its source in
`Project context`, and reuse prior findings.

Only a profile that dispatches children (it preloads
`harness/orchestration/index` and may call `harness::spawn`) may delegate
the question instead, as one bounded reference check: name the question and
the relevant source ids or file sections, and request a short answer with
citations. A profile that spawns no one never tries to.
