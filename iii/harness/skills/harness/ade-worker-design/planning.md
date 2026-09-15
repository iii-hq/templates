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
running console. Describe the expected persisted or visible result. Include
a failure or recovery path when it changes whether the feature is usable.
For live data, mutate outside the page and observe the open page update.

The Builder observes these user criteria independently. Engineers own the
implementation test matrix; the Tech Lead owns contract and integration
checks. Reference their detailed evidence without replaying all their tests.

## Consult only for a decision

This reference is sufficient for ordinary planning. Do not load the full
design manuals as preparation. If an unresolved choice would change the
spec, use one bounded reference check through `harness/orchestration/index`:
name the question and relevant source ids or file sections, and request a
short answer with citations. `harness/ade-worker-design/patterns` answers
interaction questions; `harness/ade-worker-design/console-injectable-ui`
answers host-capability questions. Consult `console-design` in that same
skill namespace only for a specific visual constraint. Reuse prior findings.
