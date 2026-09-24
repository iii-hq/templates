# ADE First-Run Experience — Action Plan

## Goal and scope

Help a new user understand what they can do in the ADE, choose an appropriate agent, and start a useful conversation without first learning iii's internal architecture.

This document is an implementation plan, not a record of completed changes. It refines the earlier [first-experience study](ade-primeira-experiencia.md) with the agreed scope. It specifically supersedes the earlier suggestion to move both base profiles into an advanced category: **hide `iii`, but keep `iii-minimal` visible under the display name `Default`.**

The initial delivery should improve the existing entry screen rather than introduce a mandatory onboarding wizard, a new intent-routing agent, or a complete UI redesign.

## 1. Agreed product decisions

1. Give the two task-oriented agents names and descriptions that explain when to use them.
2. Explicitly limit the ADE tool builder to creating tools that run **inside the ADE**. It is not a general-purpose website, standalone application, or backend-only worker builder.
3. Rewrite the template README around a short, verified path to a first result.
4. Resolve discrepancies between the documentation, shipped configuration, and visible product.
5. Make the agents' first conversations progressive and understandable without internal jargon.
6. Document and verify a small first win.
7. Hide the `iii` profile from the new-conversation gallery without deleting it or breaking inheritance.
8. Rename the **display name** of `iii-minimal` to `Default`; preserve its ID and existing inheritance references.
9. Add an optional profile-specific composer placeholder, supported by iii-directory and the ADE.
10. Do not show Traces in a new user's initial workspace. Keep it easy to open explicitly.

## 2. Ownership and compatibility boundaries

| Workstream | Primary location | Important boundary |
| --- | --- | --- |
| Agent copy and conversation instructions | `iii/harness/agents/` | Change display copy and role instructions, not profile IDs or delegation IDs. |
| Getting started and first-win documentation | `iii/harness/README.md`, `iii/harness/template.yaml` | Every documented step must match a newly generated project. |
| Configuration/documentation reconciliation | Template plus runtime verification | Do not infer runtime behavior solely from comments or an already configured machine. |
| Hide `iii`; display `iii-minimal` as `Default` | Owner of the bundled profiles, coordinated with iii-directory/ADE | These profiles are not among the five agent files currently shipped by this template. Locate their authoritative definitions before implementation. |
| Profile-specific placeholder | iii-directory and ADE workers, then template metadata | Requires a supported data contract before the template can use the new field. |
| Initial workspace without Traces | ADE worker | Change first-run initialization, not existing saved layouts. |

**Do not rename `iii-minimal` to a new ID such as `default`.** Existing `extends: iii-minimal`, saved sessions, and explicit invocations must continue to resolve. Likewise, hiding `iii` must not delete it or change its ability to serve as a parent.

Prefer changing bundled metadata at its source. Do not copy entire bundled prompts into the template merely to change visibility or a display name. If a template-only override is necessary, first verify supported override semantics, inheritance, upgrades, and packaging; document that choice explicitly.

## 3. Template changes

### T1 — Outcome-oriented agent names and descriptions

Use the following English copy:

| Stable profile ID | Display name | Description |
| --- | --- | --- |
| `ade-worker-builder` | **Create a tool in the ADE** | **Use only to create tools inside the ADE, powered by workers with built-in screens and forms.** |
| `agent-profile-creator` | **Create a custom agent** | **Use to create a reusable agent with instructions and skills for a specific task.** |
| `iii-minimal` | **Default** | **Use for general questions and development tasks in your project.** |

The `Default` row is the target bundled-profile copy, not an instruction to create a new template profile. Validate that its actual behavior supports this description.

Implementation:

- Update `name`, `description`, and relevant human-facing headings for the two template agents.
- Keep `ade-worker-builder.md` and `agent-profile-creator.md` filenames unchanged.
- Keep Tech Lead, Backend Engineer, and Frontend Engineer hidden; users should not need to choose them to start.
- Move orchestration details out of gallery descriptions; preserve them in role instructions and advanced documentation.
- Put the ADE-only scope at the beginning of the builder description so it remains clear in narrow cards.
- Reinforce this scope in the builder's body. For a request outside the ADE, explain the boundary and suggest `Default`; do not silently reinterpret the request or start the specialized workflow.
- Tell users who want an ADE tool that the builder handles the technical coordination for them.

Acceptance criteria:

- A new user can distinguish an ADE tool from a reusable agent using the visible copy alone.
- The builder's ADE-only scope is readable at 390 px and in a narrow desktop pane; it must not depend on a tooltip or truncated tail text.
- Display-name changes do not break inheritance, saved profile references, or delegation.
- An out-of-scope request does not trigger an ADE tool implementation without the user's agreement.

### T2 — Rewrite the README and generated next steps

Recommended README title: **Build with agents in the ADE**.

Suggested opening:

> This template starts the iii engine, AI agents, and the ADE: the workspace where you chat with agents and use the tools they build. Start with a small tool inside the ADE, create a reusable agent, or use Default for general work in your project.

Organize the main path as follows:

1. **What you can do:** a short explanation and the three visible choices above.
2. **Configure one supported AI provider:** document the verified credential path and prerequisites. Do not imply every available provider needs a key.
3. **Start the project:** run `iii compose --up` from the generated project directory.
4. **Open the ADE:** explain how to obtain its actual URL from verified output or configuration.
5. **Check the project folder:** explain that it is the working directory used for this conversation; show how to inspect or change it without promising sandboxing that the runtime does not guarantee.
6. **Try your first tool:** select `Create a tool in the ADE` and use the example in T5.
7. **Know what happens next:** clarify the request → confirm the plan → build → verify → open the result.
8. **Other paths:** explain `Create a custom agent` and `Default` briefly.
9. **Troubleshooting:** missing credentials, unavailable model, incorrect project folder, and how to find the ADE URL.
10. **Advanced reference:** move agent hierarchy, orchestration, container details, provider alternatives, and alternate startup commands here.

Update `template.yaml.next_steps` to point to this path. Do not tell users to choose hidden engineers or a Tech Lead. Explain that users do **not** need to create a custom agent before using the ADE.

Acceptance criteria:

- A new user can follow the main path without reading the orchestration section.
- Every profile named as an initial choice is actually visible under that name in the supported worker versions.
- Startup instructions and troubleshooting are verified on a freshly generated project.

### T3 — Reconcile documentation and product behavior

Resolve these known discrepancies:

| Issue | Required action | Verification |
| --- | --- | --- |
| README says all five template profiles appear in the picker, while three are hidden. | Document two user-facing template profiles, their internal specialists, and the bundled `Default` option separately. | Compare generated files with the live gallery and catalog. |
| Generated next steps recommend hidden technical profiles. | Recommend an outcome-based route instead. | Inspect the output of template generation. |
| README accepts shell-exported keys or `.env`; compose comments say shell exports do not reach the router in this setup. | Establish the real credential-loading behavior. Document one reliable main path, likely `.env` for this compose configuration, and only claim alternatives that are tested. | Start a fresh project without accidentally relying on inherited credentials; complete a harmless model request. |
| Documentation uses port 3113; the inspected instance uses 3123. | Document URL discovery and the actual default after verification. Do not replace every port with 3123 solely because this machine uses it. | Confirm startup/configuration output and open the resulting URL. |
| Examples mix `console`/`ade`, `shell`/`ide`, and provider lists that do not match the compose file. | Align container names, examples, dependencies, and provider activation guidance with the shipped compose configuration. | Compare the README with a fresh startup. Distinguish container/package names from function namespaces where necessary. |

Also update the builder's console-URL guidance: use observed project configuration rather than assuming a universal port.

Acceptance criteria:

- README, compose comments, profile guidance, and generated next steps do not contradict one another.
- The documented setup succeeds without credentials or preferences inherited from the reviewer's usual environment.
- Logs and examples contain no real credentials or machine-specific paths presented as universal requirements.

### T4 — Improve the first conversation

Apply to the builder and custom-agent creator:

- State the intended outcome in one short sentence when clarification is needed.
- Ask at most one or two relevant questions per turn; do not expose the internal seven-question checklist as a questionnaire.
- Inspect available project context before asking questions the agent can answer itself.
- Ask about the user's problem and desired behavior, not function IDs, inheritance, orchestration, or storage architecture.
- If the request is already clear, summarize it and move forward instead of repeating an introductory interview.
- Offer a concrete example if the request is vague.
- Explain technical terms only when needed for an actual decision.
- Present a short product-oriented plan before technical detail.
- Preserve existing confirmation boundaries before implementation or saving a new profile.
- Preserve user visibility into generated files and the existing verification requirements.

Example builder response to a vague request:

> I can help you create a tool that runs inside the ADE. What would you like to manage or automate? For example, we could start with a small task list.

Example custom-agent response:

> I can help you create an agent you can reuse for a specific task. What should it help with, and what should it avoid doing?

Acceptance criteria:

- Test a vague request, a complete request, and an out-of-scope request in fresh sessions.
- A complete request does not receive redundant setup questions.
- A vague request receives an understandable next question and a useful example.
- Users do not have to know internal IDs to complete the conversation.
- Planning and implementation remain distinct; approval and verification are not removed to make the exchange shorter.

### T5 — Document and verify a small first win

Include this copyable prompt in the README:

> Create a small task list inside the ADE. I want to add a task with a title, mark it as done, and keep my tasks after refreshing the page. Use this project's existing capabilities where possible. Do not connect to external services.

Expected scope:

- One page inside the ADE.
- Add a task with a non-empty title.
- Mark a task as done.
- Persist the result across a page refresh using an appropriate supported project capability.
- No external integrations or additional service accounts.
- Any required new capability or installation is explained before it is added; do not silently expand scope.

Document the expected planning confirmation and what the final result looks like. Completion must include a working way to open the page and a short summary of the files created. Do not promise a completion time before measuring it.

Acceptance criteria:

- Run the exercise end to end on a freshly generated project.
- Add a task, mark it done, refresh, and verify that the data and status remain.
- The result is accessible inside the ADE; a successful build alone is insufficient.
- If the exercise becomes a separate file, include it in `template.yaml.files` and verify that generation copies it.

## 4. Worker changes outside the template

### W1 — Hide `iii` and show `iii-minimal` as `Default`

Locate the authoritative bundled-profile definitions and update their presentation metadata:

- `iii`: hidden from the initial new-conversation gallery, retained for inheritance and explicit use.
- `iii-minimal`: visible, display name `Default`, description from T1.
- Preserve IDs, bodies, capability discovery, and inheritance unless a separately reviewed behavioral change is needed.
- Retain access to hidden profiles in appropriate advanced or parent-selection contexts.
- Respect explicit local overrides; do not overwrite user-authored files during an upgrade.

**Resolve the meaning of “Default” before release:** a display rename must not silently change the runtime's fallback profile. Inspect which profile is used when a user sends a message without selecting a card. Make the effective profile visible. If the product decision is that `iii-minimal` must also become the actual fallback, scope and test that routing change explicitly in the ADE/harness rather than assuming the rename accomplishes it.

Acceptance criteria:

- A clean new-conversation gallery shows `Default`, not `iii-minimal`, and does not show `iii`.
- Both stable IDs still resolve, and descendants still inherit correctly.
- Existing sessions and explicit references remain valid.
- Sending without a card selection has documented, understandable behavior; the UI never claims `Default` while routing to a different profile.

### W2 — Profile-specific composer placeholder

Owners: **iii-directory** for metadata and **ADE** for editing/rendering behavior.

Proposed metadata field: `composer_placeholder` (optional string). This is a **proposed contract**, not a claim that the field is already supported. Inspect the existing schemas before finalizing the name and implementation.

Example future template metadata, only after support ships:

```yaml
composer_placeholder: "Example: Create a task list inside the ADE where I can add tasks and mark them as done."
```

Suggested values:

| Profile ID | Placeholder |
| --- | --- |
| `ade-worker-builder` | Example: Create a task list inside the ADE where I can add tasks and mark them as done. |
| `agent-profile-creator` | Example: Create an agent that reviews my workers and suggests useful tests. |
| `iii-minimal` | Example: Explain this project and help me decide what to work on next. |

Directory work:

- Support the optional field in profile parsing, validation, serialization, list/get responses, and create/update round trips.
- Keep existing profiles valid when the field is missing.
- Treat missing, empty, or whitespace-only values as no custom placeholder.
- Set and document a reasonable length limit; treat the value as plain text, not HTML or executable instructions.
- Make this field profile-local by default: a specialized child without its own example should receive generic UI guidance, not accidentally inherit an unrelated parent's example.
- Preserve the field when other profile properties are edited.
- Keep it as presentation metadata; do not append it to the agent's instructions or conversation history.

ADE work:

- Render the selected profile's placeholder only while the composer is empty.
- Fall back to generic guidance when no profile-specific value exists or an older directory response omits the field.
- Update the placeholder when selecting or switching profiles, without changing user-authored text.
- Restore the correct guidance when the composer becomes empty again, following the product's existing selection/deselection behavior.
- Provide an optional field in the profile editor with a short explanation of its purpose.
- Preserve the composer's accessible label. A placeholder must not be the only label or the only explanation of the selected agent.
- Do not submit, prefill an actual draft, create a chat message, or trigger model usage merely because a profile is selected.

**Placeholder is not prefill:** the example is a hint inside an empty composer, not text that will be sent. If an explicit “Use example” action is later added, treat that as a separate action with clear draft-preservation behavior.

Acceptance criteria:

- Directory create → get → update → list preserves the value; omitted values remain compatible.
- Switching A → B changes guidance when empty and preserves a non-empty draft, attachments, and selection context.
- Clearing a draft restores the correct placeholder.
- Older profiles and older responses render without errors.
- The inheritance rule is covered by tests.
- Selection alone never sends content, uses a model, or alters project files.
- Examples remain understandable in narrow panes and on mobile, with keyboard and screen-reader access verified.

### W3 — Keep Traces out of the initial workspace

Owner: **ADE**.

- Initialize a genuinely new user's workspace with the main conversation surface, without a Traces pane.
- Apply this default only when no saved layout exists.
- Keep Traces available through the existing workspace/navigation controls; verify that a user can find and open it.
- Audit automatic trace-opening behavior so the pane does not immediately reappear on the first message and negate the change.
- Do not disable trace collection or remove diagnostic functionality.
- Preserve existing users' layouts, including layouts where Traces is open.
- Preserve panel behavior on narrow screens.

Acceptance criteria:

- A fresh client and fresh persisted workspace start without Traces.
- Sending the first message does not force Traces open.
- A user can explicitly open Traces and inspect real activity.
- Saved layouts survive reload and upgrade unchanged.
- A private browser window alone is not treated as proof of a clean first run, because workspace state may live on the server.

## 5. Additional items worth including

These are small safeguards or adjacent gaps, not a mandate for a larger redesign.

### A1 — Distinguish assisted agent creation from the manual editor

The gallery currently contains both a conversational creator and a `Create a new agent` action that opens a technical editor. Rename the latter to **Configure an agent manually** and give it secondary emphasis. Keep **Create a custom agent** as the assisted path.

Acceptance: users can predict which option starts a conversation and which opens a form before clicking.

### A2 — Keep the selected agent and working project understandable

The placeholder disappears as soon as the user types. Keep the selected agent identifiable independently of it, make switching possible before sending, and expose the working folder's full path on demand. Reuse existing UI where possible rather than adding another onboarding step.

Acceptance: users can tell which agent will receive the message and where it will work without clearing their draft.

### A3 — Add a release compatibility and fresh-project check

Coordinate worker and template releases. Do not ship template metadata that older workers silently discard, or documentation that promises gallery changes absent from the supported release.

Acceptance: generate a project using the intended release versions; check visible agents, metadata round trips, first message, first-win exercise, saved layouts, and credential errors. Record the versions tested. If a minimum-version mechanism exists, use it; otherwise document the supported combination explicitly.

## 6. Delivery order

| Stage | Deliverables | Dependency |
| --- | --- | --- |
| 1 — Template clarity | T1–T4: copy, scope, README, discrepancies, first-conversation instructions | Runtime verification for setup claims; coordinate references to `Default` with W1. |
| 2 — First-win proof | T5: documented exercise and observed result | Stage 1 and a fresh project. |
| 3 — Built-in profiles and initial layout | W1 and W3 | Locate bundled definitions and first-run workspace initialization; preserve upgrades. |
| 4 — Contextual prompt guidance | W2: directory contract, ADE consumption/editor, then template examples | Release the metadata support before requiring it in the template. |
| 5 — Consistency and release gate | A1–A3; integrated verification | Supported worker/template combination available. |

Stages are an implementation sequence, not permission to publish contradictory intermediate documentation. Independent work may proceed in parallel. Each change should remain backward-compatible until the coordinated release is ready.

## 7. Validation and definition of done

### Technical and behavioral checks

- [ ] Stable profile IDs, inheritance, and existing sessions still work.
- [ ] The clean gallery contains the two task-oriented profiles and `Default`, not `iii` or internal specialists.
- [ ] The builder explicitly states its ADE-only scope and handles an external-app request appropriately.
- [ ] README instructions work on a fresh project, including credentials and URL discovery.
- [ ] Vague, complete, and out-of-scope first messages receive appropriate responses.
- [ ] The first-win tool works inside the ADE and survives refresh.
- [ ] Placeholder storage, API exposure, editor persistence, fallback, inheritance, and draft preservation are tested.
- [ ] A clean first workspace has no Traces pane; explicit access and existing layouts still work.
- [ ] Desktop, narrow panes, mobile, keyboard, zoom, and both themes are checked for the changed UI.
- [ ] The supported template/worker versions are recorded, with no unsupported metadata or misleading routing labels.

### Short usability check

Test with 5–8 developers unfamiliar with iii, without a product introduction. Ask them to explain the available choices, start an ADE tool, identify how to create a reusable agent, and locate the final result.

Proposed targets, not measured outcomes:

- At least 80% choose the appropriate path without assistance.
- At least 80% understand that the ADE tool builder is exclusively for tools inside the ADE.
- Median time to a meaningful first request is at most 60 seconds once the environment is configured.
- No accidental execution from selecting an agent or seeing an example.

Record actual counts, misunderstandings, and completion times. A small qualitative sample is useful for iteration, not a basis for claims of statistical significance.

## 8. Out of scope for this iteration

- A mandatory guided tour or multi-step onboarding wizard.
- A new agent that automatically routes every request by intent.
- Renaming stable profile IDs or rebuilding the inheritance hierarchy.
- Removing tracing, hiding errors, or changing permissions through gallery visibility.
- A broad redesign of provider setup or progress reporting; revisit separately if first-run testing shows these remain major blockers.
- A promise that hiding Traces or shortening text alone proves the experience is understandable.
