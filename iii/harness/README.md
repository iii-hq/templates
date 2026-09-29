# Build with agents in the ADE (Agentic Development Environment)

This template starts the iii engine, AI agents, and the ADE: the workspace
where you chat with agents and use the tools they build. Start with a small
tool inside the ADE, create a reusable agent, or use Default for general work
in your project.

## What you can do

When you start a new conversation in the ADE, choose one of these:

| Choice | Use it to |
| --- | --- |
| **Create a tool in the ADE** | Create a tool that runs inside the ADE, with its own screens and forms, powered by a worker. Only for tools inside the ADE: not for standalone websites, apps or backend-only services. |
| **Create a custom agent** | Create a reusable agent with instructions and skills for a specific task. Once saved, it becomes a choice here too. |
| **Default** | Ask general questions and get help with development tasks in your project. |

You do not need to create a custom agent before using the ADE. **Create a
tool in the ADE** plans, builds and verifies the tool for you in the same
conversation.

> **Default** is the built-in general agent. `iii-directory` versions that
> predate it list the same agent as `iii-minimal`.

## Get started

You need:

- The iii CLI: `curl -fsSL https://install.iii.dev/iii/main/install.sh | sh`
- A project created from this template: `iii project init <name> -t harness`
- An API key for one of the AI providers below
- To create tools in the ADE: Node.js 22 or later and pnpm 10 or later. The
  tools are Node.js workers that are built in your project folder.

Run every command below from the project folder.

### 1. Configure one AI provider

This project enables three model providers: Anthropic, OpenAI and DeepSeek.
You need a key for only one of them. Open `.env` and paste the key after the
matching name, for example:

```bash
ANTHROPIC_API_KEY=sk-ant-...
```

Leave the other lines empty. `.env` is listed in `.gitignore`, so the key
stays out of git.

Put the key in `.env`, not in a shell `export`. `worker-compose.yaml` passes
`.env` to the model router and does not pass variables exported in your
shell, so an exported key does not reach it.

To use another provider, or one that signs in without an API key, see
[Other providers](#other-providers).

### 2. Start the project

```bash
iii compose --up
```

This starts the engine and every worker listed in `worker-compose.yaml`, and
keeps running in the foreground: leave this terminal open. The first run
downloads the workers, so it takes longer than later runs. Compose prints a
`ready` line for each worker and then an `up: … changed` summary.

Compose can also be controlled like any other iii worker. Start the daemon
with `iii compose`, then bring the project up with:

```bash
iii trigger compose::up --namespace default file=./worker-compose.yaml --timeout-ms 300000
```

If you edit `.env` while the project is running, restart the model router so
it reads the change:

```bash
iii trigger compose::restart worker=llm-router
```

### 3. Open the ADE

Open **http://127.0.0.1:3113**, the ADE's default address.

If nothing answers there, the ADE may be using another port: after its first
start it keeps the port in its configuration entry. Compose names that entry
`<namespace>-<container>`, so it is `default-ade` in this project. In a
second terminal, from the project folder, run:

```bash
iii trigger configuration::get id=default-ade
```

Then open `http://127.0.0.1:<http_port>`, using the `http_port` value it
prints. The ADE also logs the address it listens on:

```bash
iii compose logs ade --tail 1000 | grep "console http listening"
```

### 4. Check the project folder

The folder name next to the message box is the conversation's working
directory: where the agent reads and creates files. New conversations start
in the project folder, the one that contains `worker-compose.yaml`. Hover
over the folder name to see its full path; select it to choose another
folder before you send.

The working directory is where agents start, not a sandbox: it does not stop
an agent from running commands or changing files elsewhere on your machine.

### 5. Try your first tool

Select **Create a tool in the ADE** and send this message:

```text
Create a small task list inside the ADE. I want to add a task with a title, mark it as done, and keep my tasks after refreshing the page. Use this project's existing capabilities where possible. Do not connect to external services.
```

### 6. Know what happens next

1. **Clarify.** The agent may ask one or two short questions. A clear request
   like this one needs few or none.
2. **Confirm the plan.** It shows a short plan: what the tool does, where it
   appears in the ADE, what is kept after a refresh, what is out of scope,
   and the checks it will run. It saves the details to
   `specs/<tool-name>.md`. Nothing is built until you confirm. If the tool
   needs something the project does not already have, the plan says so and
   asks you first.
3. **Build.** After you confirm, it builds the tool itself, one step at a
   time: the design, the worker and its screens. The tool's worker is
   created inside your project folder and added to `worker-compose.yaml`.
4. **Verify.** It checks each point of the plan in the running ADE, in a
   browser session you can watch.
5. **Open the result.** It finishes with a link to the new page, the result
   of each check, and a short list of the files it created.

For this example, expect a plan for a single page inside the ADE where you
can add a task with a non-empty title, mark it as done, and still see your
tasks and their status after refreshing the page. It should keep the tasks
with a capability this project already runs, such as the `state` worker, and
need no external services or extra accounts.

## Other paths

- **Create a custom agent.** Describe what the agent should help with and
  what it should avoid doing, for example: "Create an agent that reviews my
  workers and suggests useful tests." It shows a short summary and the full
  profile file before saving anything, then writes `agents/<id>.md`. The new
  agent appears in the new-conversation gallery without a restart.
- **Default.** Use it for everything else: questions about iii or this
  project, code changes, debugging, or work outside the ADE such as a
  standalone app.

## Troubleshooting

| Problem | What to do |
| --- | --- |
| The model picker shows no models, or the ADE asks you to configure a provider | Check that one key in `.env` is filled in, then run `iii trigger compose::restart worker=llm-router`. `iii trigger router::provider::list` shows which providers report `configured: true`. |
| A key exported in your shell is ignored | Put it in `.env` instead (step 1). |
| The selected model fails or is unavailable | Choose another model in the model picker next to the message box. `iii trigger router::models::list` lists the models your configured providers offer. |
| The agent works in the wrong folder | Select the folder name next to the message box and choose your project folder before sending (step 4). |
| http://127.0.0.1:3113 does not open | Keep `iii compose --up` running and find the ADE's actual address (step 3). |
| Building a tool fails while installing packages | Check that Node.js 22+ and pnpm 10+ are installed and on your `PATH`. |

## Advanced reference

You do not need anything below to use the ADE.

### Agents in this template

`agents/` ships two profiles, the two choices described above. The tool
builder holds the architect, backend and frontend roles itself, one phase
at a time, so no hidden specialist profiles are needed. **Default** and the
other built-in profiles come from the `iii-directory` worker, not from this
folder.

Every profile here extends `iii-minimal` and preloads its skills from
`skills/harness/…`; the harness freezes both into every session that runs as
that profile. `iii-directory` versions with the built-in `default` profile
show it as **Default** and keep `iii-minimal` as a hidden alias of it;
earlier versions list `iii-minimal` itself. Extending `iii-minimal` resolves
on both. Display names can change; the profile id (the file name) is what
`extends`, saved sessions and `harness::send { options: { agent: "<id>" } }`
use.

The two gallery profiles also set `composer_placeholder`: the example request
the ADE shows in the empty message box while that profile is selected. It is
never sent, never added to the prompt and not inherited through `extends`
(at most 200 characters of plain text). `iii-directory` versions without the
field ignore it.

```text
default                           built-in, shown as Default
└── iii-minimal                   built-in hidden alias of default
    ├── ade-worker-builder        Create a tool in the ADE: plans, builds and verifies the tool with you in one conversation
    └── agent-profile-creator     Create a custom agent: plans a new profile with you and writes it beside these
```

| Profile id | Shown as | Role |
| --- | --- | --- |
| `ade-worker-builder` | Create a tool in the ADE | Builds tools inside the ADE only, alone and in phases: plans the tool with you until its spec is unambiguous (`specs/<worker>.md`), writes the architecture, builds the Node worker and its injected UI, and accepts it only after exercising every criterion in the running ADE. Loads each phase's playbook (`skills/harness/ade-solo/…`) only when it enters that phase. |
| `agent-profile-creator` | Create a custom agent | Plans a new profile with you, using the existing ones as the reference, and writes `agents/<id>.md`. |

### Orchestration

The tool builder does not orchestrate: it crosses its phases itself.
`agent-profile-creator` uses orchestration for reference checks, and so can
any profile you create that dispatches other agents. There is no board and
no message bus between agents: orchestration is the `harness/orchestration`
skill, two wires with one direction each:

- **Downstream is `harness::spawn`.** The `task` is the child's whole brief:
  the spec or architecture file by path, the project root, what is out of
  scope, the checks that mean done, and the state key for its result. A
  child that must spawn children of its own is spawned with
  `options: { orchestrator: true }`.
- **Upstream is `state`.** The child writes one result document
  (`outcome`, `summary`, `evidence`, `files`, `questions`) to scope
  `results`, key `<its session id>`, and stops. The parent armed a `state`
  wake on that key before spawning, so the write starts its next turn. The
  child never looks for a parent; feedback comes back as a new task in the
  same session (`harness::spawn` with the same `session_id`).
- Results are visible on the ADE's state page (`#/worker/state`, or the
  State page in the workspace), scope `results`.
- Reports keep those five fields and stay within 500 words (300 for
  reference checks), with detailed observations in cited project
  artifacts.

### Context and verification

The tool builder preloads `harness/ade-solo/plan` and
`harness/ade-worker-design/planning`, and fetches each later phase's
playbook (`harness/ade-solo/architect`, `backend`, `frontend`, `accept`)
only when it enters that phase. Each playbook names the manual sections the
phase may read, so no manual is loaded whole or ahead of time. A phase
counts as done in the spec's `Progress` only when its playbook was fetched
in that session and its gate checks ran; the line names the playbook. The
spec's `Project context` carries source paths and observed facts, so later
phases and turns investigate only gaps and changed facts. Browser contracts
are loaded when verification begins; shorter function preload lists do not
narrow inherited permissions.

The builder verifies every phase against the running system: functions
answer real calls, the UI passes static, delivery, rendering and evidence
checks, and each acceptance criterion is observed once in the running ADE.
Accept reuses the observations the build phases recorded against the
current assets and observes only what is missing or changed, in one short
browser run. Corrections rerun affected checks and their dependencies;
earlier evidence is reused only while it remains applicable. Detailed
observations go to `specs/<worker>.evidence.md`.

### Models and skills

The profiles ship without a `model`, so each session uses the model selected
when the message is sent. To pin one, add `model: <provider>::<model>` (and
optionally `reasoning_effort`) to a profile's frontmatter;
`iii trigger router::models::list` prints the catalog. Skill ids are prefixed
`harness/` because `iii-directory` only lists skills whose namespace is a
worker in this compose file.

### What runs in this project

`worker-compose.yaml` declares these containers. The first start downloads
them into `~/.iii/compose/packages`; later starts use that cache.

| Container | Why it is here |
| --- | --- |
| `state`, `queue`, `cron`, `session-manager`, `iii-directory` | Services the harness depends on: storage, queues, schedules, conversation history, and the directory of agents, skills and functions |
| `llm-router` | Routes model calls and resolves provider credentials; reads `.env` |
| `provider-anthropic`, `provider-openai` | Model providers. The harness waits for both, so both run even if you use only one key |
| `provider-deepseek` | Model provider enabled by default; its key is optional |
| `context-manager` | Summarizes long conversations (`/compact`) |
| `harness` | The agent turn loop |
| `ade` | The ADE web UI and its `/ws` connection to the engine |
| `ide` | Files and commands for agents and the ADE |
| `browser` | Chromium sessions and page fetches that agents use to verify their work |

Container names are not always function namespaces: `ade` registers
`console::*`, `ide` registers `shell::*` and `coder::*`, `llm-router`
registers `router::*`, and `iii-directory` registers `directory::*`.

### Other providers

`worker-compose.yaml` has a ready-to-uncomment block for each provider below.
To add one:

1. Uncomment its block in `worker-compose.yaml`.
2. For an API-key provider, uncomment its line in `.env` and paste the key.
3. Run `iii trigger compose::restart` so compose re-reads
   `worker-compose.yaml`. Add the container to the `harness` `start_after`
   list if the harness should wait for it.

| Provider              | Environment variable |
| --------------------- | -------------------- |
| `provider-kimi`       | `MOONSHOT_API_KEY`   |
| `provider-xai`        | `XAI_API_KEY`        |
| `provider-zai`        | `ZAI_API_KEY`        |
| `provider-openrouter` | `OPENROUTER_API_KEY` |
| `provider-llamacpp`   | `LLAMACPP_API_KEY`   |

Three experimental providers authenticate without an API key. They are also
commented out in `worker-compose.yaml`.

| Provider                  | How it authenticates |
| ------------------------- | -------------------- |
| `provider-claude-code`    | Reads `~/.claude/.credentials.json`, written by the Claude Code CLI when you sign in there |
| `provider-openai-codex`   | Reads `~/.codex/auth.json`, written by the Codex CLI when you sign in there |
| `provider-github-copilot` | A GitHub device flow. Call `iii trigger provider::github-copilot::login::start`, enter the `user_code` it returns at the verification URL, then call `iii trigger provider::github-copilot::login::poll`. |
