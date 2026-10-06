# Build with agents in the ADE (Agentic Development Environment)

This template starts the iii engine, AI agents, and the ADE: the workspace
where you chat with agents and use the apps and tools they build. Start with a
small app or tool, create a reusable agent, or use Default for general work in
your project.

## What you can do

When you start a new conversation in the ADE, choose one of these:

| Choice | Use it to |
| --- | --- |
| **Create an app or tool** | Describe an app or a tool in one line and get a running worker in one conversation: it starts from a ready-made template, opens a live admin panel in the ADE as soon as the worker starts, then shapes the data, actions and public page to your request. It builds one list of records with text, number and yes/no fields, plus actions and a public page; for anything else, use Default. |
| **Create a custom agent** | Create a reusable agent with instructions and skills for a specific task. Once saved, it becomes a choice here too. |
| **Default** | Ask general questions and get help with development tasks in your project. |

You do not need to create a custom agent before using the ADE. **Create an
app or tool** builds and verifies it for you in the same conversation.

> **Default** is the built-in general agent. `iii-directory` versions that
> predate it list the same agent as `iii-minimal`.

## Get started

You need:

- The iii CLI: `curl -fsSL https://install.iii.dev/iii/main/install.sh | sh`
- A project created from this template: `iii project init <name> -t harness`
- An API key for one of the AI providers below
- To create apps and tools: Node.js 22 or later and pnpm 10 or later. They
  are Node.js workers that are built in your project folder.

Run every command below from the project folder.

### 1. Configure one AI provider

This project enables three model providers: Anthropic, OpenAI and DeepSeek.
You need a key for only one of them, and you connect it in the ADE: the first
time you open it (step 3), the setup wizard opens on **Connect a model**.
Paste the key there. The `secrets` worker stores it encrypted, and the model
router's configuration keeps only a reference, `secret://ANTHROPIC_API_KEY`.

If you prefer to keep keys in a `.env` file, choose **Environment variable**
in the wizard and paste the key: the `secrets` worker writes it to `.env` in
the project folder, creating the file, and the router reads
`env://ANTHROPIC_API_KEY` through the `secrets` worker, which reads the file
each time the key is used, so an edit applies without a restart. A key you
already have in `.env`, for example

```bash
ANTHROPIC_API_KEY=sk-ant-...
```

or exported in your shell profile is found and offered. `.env` is listed in
`.gitignore`, so the key stays out of git.

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

Edits to `.env` apply while the project runs: the `secrets` worker reads the
file each time a key is used, so nothing needs a restart.

### 3. Open the ADE

Open **http://127.0.0.1:3113**, the ADE's default address. On the first
visit the setup wizard opens: connect the provider from step 1 there.

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

### 5. Try your first app

Select **Create an app or tool** and send this message:

```text
Build an expense tracker. Each expense has a description, an amount, a category, and whether it was reimbursed. Show the total still to be reimbursed.
```

### 6. Know what happens next

1. **Start.** The agent names the worker, creates it from the
   `worker-node-collection` template inside your project folder, and adds it
   to `worker-compose.yaml`. The first app also adds an `http` container,
   which serves public pages on `http://127.0.0.1:3111` without
   authentication: never expose port 3111 through a public proxy or tunnel.
   It writes a plan of at most five lines and marks
   its guesses `Assumed:`. It does not ask questions first: it builds exactly
   what you asked for, and nothing more.
2. **Open the panel.** As soon as the worker starts, its admin panel opens
   in the ADE (the first app also installs its packages, which takes longer). It becomes your app as soon as the agent saves the data model.
3. **Build.** It shapes the data, adds any actions the request needs (each
   with its own tests) and rewrites the public page.
4. **Verify.** It runs the type check, the tests and the build, creates a few
   demo records with real calls, and opens the public page at
   `http://127.0.0.1:3111/<name>` in a browser session you can watch.
5. **Read the report.** It finishes with what it verified, what it assumed
   and what it did not verify.

For this example, expect an `expense-tracker` worker whose admin panel lists
expenses with those four fields, and a public page where you can add an
expense, mark it as reimbursed and see the total still to be reimbursed.
Records are kept in the `state` worker this project already runs, so they
survive a refresh and need no external services or extra accounts.

## Other paths

- **Create a custom agent.** Describe what the agent should help with and
  what it should avoid doing, for example: "Create an agent that reviews my
  workers and suggests useful tests." It shows a short summary and the full
  profile file before saving anything, then writes `agents/<id>.md`. The new
  agent appears in the new-conversation gallery without a restart.
- **Default.** Use it for everything else: questions about iii or this
  project, code changes, debugging, or anything the other choices do not
  cover.

## Troubleshooting

| Problem | What to do |
| --- | --- |
| The model picker shows no models, or the ADE asks you to configure a provider | Connect a key in the ADE (step 1): **Set up the harness** in the command palette (`Ctrl+K`), or **Configure** in the model picker. `iii trigger router::provider::list` shows which providers report `configured: true`, and `credential_error` says why a key does not resolve. |
| A key in `.env` or exported in your shell is not used | Nothing reads them by themselves: connect the provider in the ADE (step 1), which finds them. |
| The selected model fails or is unavailable | Choose another model in the model picker next to the message box. `iii trigger router::models::list` lists the models your configured providers offer. |
| The agent works in the wrong folder | Select the folder name next to the message box and choose your project folder before sending (step 4). |
| http://127.0.0.1:3113 does not open | Keep `iii compose --up` running and find the ADE's actual address (step 3). |
| Building an app or tool fails while installing packages | Check that Node.js 22+ and pnpm 10+ are installed and on your `PATH`. |

## Advanced reference

You do not need anything below to use the ADE.

### Agents in this template

`agents/` ships two profiles, the first two choices described above. The
app builder does the whole job itself in one session, so no hidden
specialist profiles are needed. **Default** and the other built-in profiles
come from the `iii-directory` worker, not from this folder.

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
    ├── ade-worker-builder        Create an app or tool: scaffolds a worker, opens its panel, reshapes it into your app
    └── agent-profile-creator     Create a custom agent: plans a new profile with you and writes it beside these
```

| Profile id | Shown as | Role |
| --- | --- | --- |
| `ade-worker-builder` | Create an app or tool | Scaffolds the `worker-node-collection` template with `coder::scaffold-worker` and opens its panel in the ADE, then, in one session, edits the model, the domain actions and the public page into the app you asked for and verifies it with real calls and the rendered pages. |
| `agent-profile-creator` | Create a custom agent | Plans a new profile with you, using the existing ones as the reference, and writes `agents/<id>.md`. |

### Orchestration

The app builder does not orchestrate: it does the whole job in one session.
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

The app builder preloads `harness/iii-node/index` and the contracts of the
functions it calls. It reads only five template files, the ones it may
change (`src/model.ts`, `src/actions.ts`, `web/client.ts`, `web/App.tsx` and
`web/app.css`), and adds `test/actions.test.ts` for new actions: the rest of the `worker-node-collection` template is generic
and adapts to the model. Shorter function preload lists do not narrow
inherited permissions.

It verifies against the running system: the type check, the tests and the
build pass, every function it reports as verified answered a real call, and a
browser snapshot of the public page shows
the demo records. A public route of the app's own is proven on its URL with
its own method. Its last message separates what it verified, what it assumed
and what it did not verify.

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
| `llm-router` | Routes model calls and resolves provider credentials through `secrets` |
| `secrets` | Keeps provider keys: encrypted (`secret://NAME`), or read from `.env` on every use (`env://NAME`) |
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

Any other provider worker in the registry can be added from the ADE. The setup
wizard (**Set up the harness** in the command palette) lists them under
**Other providers**, adds the one you pick to `worker-compose.yaml`, and
connects its key the same way as in step 1. From a terminal:

```bash
iii trigger compose::add worker=provider-kimi
```

then connect its key with **Configure** in the model picker. Add the container
to the `harness` `start_after` list in `worker-compose.yaml` if the harness
should wait for it.

| Provider              | Environment variable |
| --------------------- | -------------------- |
| `provider-kimi`       | `MOONSHOT_API_KEY`   |
| `provider-xai`        | `XAI_API_KEY`        |
| `provider-zai`        | `ZAI_API_KEY`        |
| `provider-openrouter` | `OPENROUTER_API_KEY` |
| `provider-llamacpp`   | `LLAMACPP_API_KEY`   |

Three experimental providers authenticate without an API key. The setup
wizard recommends Claude Code and Codex when you are signed in to them on this
machine; add GitHub Copilot with `compose::add`.

| Provider                  | How it authenticates |
| ------------------------- | -------------------- |
| `provider-claude-code`    | Reads `~/.claude/.credentials.json`, written by the Claude Code CLI when you sign in there |
| `provider-openai-codex`   | Reads `~/.codex/auth.json`, written by the Codex CLI when you sign in there |
| `provider-github-copilot` | A GitHub device flow. Call `iii trigger provider::github-copilot::login::start`, enter the `user_code` it returns at the verification URL, then call `iii trigger provider::github-copilot::login::poll`. |
