# Build with agents in the ADE (Agentic Development Environment)

This template starts the iii engine, AI agents, and the ADE: the workspace
where you chat with agents and use the apps and tools they build. Start with a
small app from the setup wizard's examples, or use Default for general work in
your project.

## What you can do

When you start a new conversation in the ADE, choose an agent from the
gallery. **Default** answers general questions and helps with development
tasks in your project. Agents come from the `iii-directory` worker, which
downloads them on demand.

> `iii-directory` versions that predate **Default** list the same agent as
> `iii-minimal`.

## Get started

You need:

- The iii CLI: `curl -fsSL https://install.iii.dev/iii/main/install.sh | sh`
- A project created from this template: `iii project init <name> -t harness`
- An API key for one AI provider, such as Anthropic, OpenAI or DeepSeek
- To create apps and tools: Node.js 22 or later and pnpm 10 or later. They
  are Node.js workers that are built in your project folder.
- Chrome or Chromium, which agents use to check the pages they build. If this
  machine has neither, the setup wizard downloads Chromium for you.

Run every command below from the project folder.

### 1. Configure one AI provider

The project starts without a model provider: you add the one you have a key
for in the ADE. The first time you open it (step 3), the setup wizard opens
on **Connect a model**. Choose the provider (Anthropic, OpenAI, OpenRouter,
DeepSeek, xAI, Kimi or Z.AI) and paste its key. The wizard adds the
provider's worker to `worker-compose.yaml`, the `secrets` worker stores the
key encrypted, and the model router's configuration keeps only a reference,
`secret://ANTHROPIC_API_KEY`.

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

For the full list, or a provider that signs in without an API key, see
[Model providers](#model-providers).

After the model, the wizard offers **Judge**, an optional step: a small
model that answers the many tiny decisions agents make (which function to
call, how to fix a malformed call, which element of a page to click), so
your main model spends its tokens on the work itself. You can skip it and
add it later; see [Judge](#judge).

While you go through these steps, the wizard also installs the
[deepwork](https://workers.iii.dev/kits/iii/deepwork) kit in the background:
multi-agent runs that plan a goal as kanban tickets, work them in parallel and
verify each result. It adds the `kanban` worker and the kit's agents, and the
last step shows when it is done. A profile of yours with the same name holds
the install for a review in Directory > Kits. To skip the kit, remove it from
`kits:` in `onboarding.yaml`.

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
iii call compose::up --namespace default file=./worker-compose.yaml --timeout-ms 300000
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
iii call configuration::get id=default-ade
```

Then open `http://127.0.0.1:<http_port>`, using the `http_port` value it
prints. The ADE also logs the address it listens on:

```bash
iii compose logs ade --tail 1000 | grep "console http listening"
```

To run the ADE on another port, for example beside another iii project, see
[Ports and network access](#ports-and-network-access).

### 4. Check the project folder

The folder name next to the message box is the conversation's working
directory: where the agent reads and creates files. New conversations start
in the project folder, the one that contains `worker-compose.yaml`. Hover
over the folder name to see its full path; select it to choose another
folder before you send.

The working directory is where agents start, not a sandbox: it does not stop
an agent from running commands or changing files elsewhere on your machine.

### 5. Try your first app

On the setup wizard's last step, select **Build an expense tracker**. A new
conversation starts with the agent the example names and a model this machine
has, and sends this message:

```text
Build an expense tracker. Each expense has a description, an amount, a category, and whether it was reimbursed. Show the total still to be reimbursed.
```

The step offers a few other examples too. Reopen it any time from the command
palette: **Set up the harness**. See [Example prompts](#example-prompts) to
change them.

### 6. Know what happens next

1. **Start.** The agent names the worker, creates it from the
   `worker-node-ade` template inside your project folder, and adds it
   to `worker-compose.yaml`. The first app also adds an `http` container,
   which serves public pages on port 3111 (`http://127.0.0.1:3111`) without
   authentication. Like the ADE, it listens on every network interface, so
   other devices on your network can open those pages; never expose port
   3111 through a public proxy or tunnel. If another project already uses
   port 3111, see [Ports and network access](#ports-and-network-access).
   It writes a plan of at most five lines and marks
   its guesses `Assumed:`. It does not ask questions first: it builds exactly
   what you asked for, and nothing more.
2. **Open the panel.** As soon as the worker starts, its admin panel opens
   in the ADE (the first app also installs its packages, which takes longer). It becomes your app as soon as the agent saves the data model.
3. **Build.** It shapes the data, adds any actions the request needs (each
   with its own tests) and rewrites the public page.
4. **Verify.** It runs the type check, the tests and the build, creates a few
   demo records with real calls, and opens the public page at
   `http://127.0.0.1:3111/<name>` (or the port this project's `http` uses,
   which it reads from `http::status`) in a browser session you can watch.
5. **Read the report.** It finishes with what it verified, what it assumed
   and what it did not verify.

For this example, expect an `expense-tracker` worker whose admin panel lists
expenses with those four fields, and a public page where you can add an
expense, mark it as reimbursed and see the total still to be reimbursed.
Records are kept in the `state` worker this project already runs, so they
survive a refresh and need no external services or extra accounts.

## Other paths

- **Default.** Use it for everything else: questions about iii or this
  project, code changes, debugging, or anything the other choices do not
  cover.

## Troubleshooting

| Problem | What to do |
| --- | --- |
| The model picker shows no models, or the ADE asks you to configure a provider | Connect a key in the ADE (step 1): **Set up the harness** in the command palette (`Ctrl+K`), or **Configure** in the model picker. `iii call router::provider::list` shows which providers report `configured: true`, and `credential_error` says why a key does not resolve. |
| A key in `.env` or exported in your shell is not used | Nothing reads them by themselves: connect the provider in the ADE (step 1), which finds them. |
| The selected model fails or is unavailable | Choose another model in the model picker next to the message box. `iii call router::models::list` lists the models your configured providers offer. |
| The agent works in the wrong folder | Select the folder name next to the message box and choose your project folder before sending (step 4). |
| http://127.0.0.1:3113 does not open | Keep `iii compose --up` running and find the ADE's actual address (step 3). |
| The `http` container stops with `Address in use`, or `http://127.0.0.1:3111/<name>` answers with another project's page or a `NOT_FOUND` error | Another project already serves port 3111. Give this project's `http` container another port: [Ports and network access](#ports-and-network-access). |
| The agent reports that no Chrome executable was found (`chromium_missing`), so it could not check the public page | The `browser` worker needs Chromium. Choose **Install Chromium for the browser worker** in the command palette (`Ctrl+K`), or **Install Chromium** on the failed call in the chat: the setup wizard's **Browser** step downloads it once for this machine (about 200 MB, kept in `~/.cache/iii/browser`), or shows the command to install it yourself. |
| Building an app or tool fails while installing packages | Check that Node.js 22+ and pnpm 10+ are installed and on your `PATH`. |

## Advanced reference

You do not need anything below to use the ADE.

### Example prompts

`onboarding.yaml` lists the examples the setup wizard shows on its last
step. Add, change or remove entries there; the ADE reads the file each time
the step opens. Each entry has a `title`, an optional `description`, the
`agent` profile the conversation uses (an id `iii-directory` serves, such
as `default`), the `prompt` the
conversation sends, and `models` in order of preference:

```yaml
prompts:
  - title: Build a TODO app
    description: A todo list with notes, and a public page that counts what is still open
    agent: default
    prompt: >-
      Build a TODO app. Each todo has a title, notes, and whether it is done.
      Show how many todos are still open.
    models:
      - { provider: claude-code, model: claude-sonnet-5-5, effort: medium }
      - { provider: anthropic, model: claude-sonnet-5-5, effort: medium }
      - { provider: openai, model: gpt-6.1-sol }
```

`provider` and `model` are the ids `iii call router::models::list`
prints; a bare model id also matches the id a provider prefixes
(`claude-sonnet-5-5` matches `claude-code/claude-sonnet-5-5`). The first
model this machine has is selected, with its reasoning `effort` (`minimal`,
`low`, `medium`, `high`, `xhigh` or `off`; leave it out to keep the model's
default). When none is available, the conversation keeps its
usual model. An invalid entry is skipped, and without the file the step
shows no examples.

### What runs in this project

`worker-compose.yaml` declares these containers. The first start downloads
them into `~/.iii/compose/packages`; later starts use that cache.

| Container | Why it is here |
| --- | --- |
| `state`, `queue`, `cron`, `session-manager`, `iii-directory` | Services the harness depends on: storage, queues, schedules, conversation history, and the directory of agents, skills and functions |
| `llm-router` | Routes model calls and resolves provider credentials through `secrets` |
| `secrets` | Keeps provider keys: encrypted (`secret://NAME`), or read from `.env` on every use (`env://NAME`) |
| `context-manager` | Summarizes long conversations (`/compact`) |
| `harness` | The agent turn loop |
| `ade` | The ADE web UI and its `/ws` connection to the engine |
| `ide` | Files and commands for agents and the ADE |
| `browser` | Chromium sessions and page fetches that agents use to verify their work. It uses the Chrome or Chromium installed on this machine; when there is none, the setup wizard's **Browser** step downloads one |

No model provider is listed. Containers are added as you use the project,
each at the end of `worker-compose.yaml` under `# added by compose::add`:
the provider you connect (`provider-<name>`, see
[Model providers](#model-providers)), Judge if you set it up (`judge` and
`judge-<option>`, see [Judge](#judge)), and every app or tool an agent
builds (its worker, plus `http` for public pages).

Container names are not always function namespaces: `ade` registers
`ade::*`, `ide` registers `shell::*` and `coder::*`, `llm-router`
registers `router::*`, and `iii-directory` registers `directory::*`.

### Model providers

Any provider worker in the registry can be added from the ADE. The setup
wizard (**Set up the harness** in the command palette) lists the providers,
adds the one you pick to `worker-compose.yaml`, and connects its key the same
way as in step 1. From a terminal:

```bash
iii call compose::add worker=provider-anthropic
```

then connect its key with **Configure** in the model picker. Add the container
to the `harness` `start_after` list in `worker-compose.yaml` if the harness
should wait for it.

| Provider              | Environment variable |
| --------------------- | -------------------- |
| `provider-anthropic`  | `ANTHROPIC_API_KEY`  |
| `provider-openai`     | `OPENAI_API_KEY`     |
| `provider-deepseek`   | `DEEPSEEK_API_KEY`   |
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
| `provider-github-copilot` | A GitHub device flow. Call `iii call provider::github-copilot::login::start`, enter the `user_code` it returns at the verification URL, then call `iii call provider::github-copilot::login::poll`. |

### Judge

Judge answers the small, typed decisions agents make, with a model trained
only for that, instead of spending the main model's tokens on them:

| Where | What Judge does |
| --- | --- |
| Function search | Picks the right function among everything your project registers, instead of putting every schema in the prompt |
| Argument repair | Fixes a malformed tool call before it fails, without another round trip to the model |
| Browser automation | Chooses which element of a page an agent should act on |

Without Judge everything still works: function search falls back to
keyword matching, and a broken tool call goes back to the main model.

Set it up in the setup wizard's **Judge** step, or later with **Set up the
harness** in the command palette (`Ctrl+K`). Choose who answers:

| Option | Runs | Needs |
| --- | --- | --- |
| **Jev by TypeSafe** (recommended) | Hosted by TypeSafe: fast and the most accurate | A TypeSafe API key (`TYPESAFE_API_KEY`), from [typesafe.ai](https://typesafe.ai) |
| **Decisions by OpenAI** | Hosted by OpenAI: the Decisions API | An OpenAI API key (`OPENAI_API_KEY`), from [platform.openai.com](https://platform.openai.com/api-keys); one already saved for OpenAI models is reused |
| **Clef by Cloudflare** | On this machine, Cloudflare's Clef-Flash (a 9B decision model) through llama.cpp; a GPU is recommended | Downloads a 6.5 GB GGUF model once |
| **Laya** | On this machine; a CPU is enough | Downloads its checkpoints once |
| **Decider** | On this machine, a 4B model served by llama.cpp; a GPU is recommended | Downloads a GGUF model once |

The wizard adds two containers, the `judge` hub and the option's worker
(`judge-typesafe`, `judge-openai`, `judge-clef`, `judge-laya` or `judge-decider`), and points the hub at
it (`provider: typesafe` in the `default-judge` configuration entry). A
hosted judge's key is stored encrypted by the `secrets` worker, and only its
reference is written to the option's entry: `secret://TYPESAFE_API_KEY` in
`default-judge-typesafe`, `secret://OPENAI_API_KEY` in `default-judge-openai`.

From a terminal:

```bash
iii call compose::add worker=judge-typesafe
iii call compose::add worker=judge
```

then connect its key in the wizard's **Judge** step.

### Ports and network access

Three addresses can collide with another iii project on the same machine:

| What | Default | Where it is set |
| --- | --- | --- |
| Engine | `ws://127.0.0.1:49134` | `engine.url` in `worker-compose.yaml` |
| ADE | port `3113` | `http_port` of the `ade` container (configuration entry `default-ade`) |
| Public pages | port `3111` | `port` of the `http` container (configuration entry `http`), added with the first app |

The engine port is changed only in `worker-compose.yaml`: edit `engine.url`
and start the project again. `iii call` and `iii compose` commands run
from the project folder read the address from there.

The ADE and `http` ports can be changed in two ways.

**Option 1: `config_override` in `worker-compose.yaml`.** Compose applies it
every time it starts the container, so it is the setting to commit with the
project:

```yaml
  ade:
    worker: package://ade
    version: "latest"
    config_override:
      http_port: 3123

  # Added by the first app; declare it yourself to choose its port before
  # that, or add config_override to the entry the agent added.
  http:
    worker: package://http
    version: "latest"
    config_name: http
    config_override:
      port: 3121
```

Then stop the project (`Ctrl+C` in the terminal running `iii compose --up`)
and start it again. At every start, Compose builds the container's settings
from the worker's published defaults plus the fields under `config_override`;
the stored entry (`config/<entry>.yaml`) is not used while an override is
set, so changes made in the ADE's Configuration page or with
`configuration::set` last only until the next start. Read the active value
with `iii call configuration::get`. For the ADE, which keeps its trace
views and other preferences in its entry, option 2 keeps them.

**Option 2: `configuration::set`, while the project runs.** The change
applies at once, without a restart, and is saved in `config/<entry>.yaml`.
`configuration::set` replaces the whole value, so read it, change one field
and write it back (this uses `jq`):

```bash
iii call configuration::set --json "$(iii call configuration::get id=http | jq -c '.value.port = 3121')"
iii call configuration::set --json "$(iii call configuration::get id=default-ade | jq -c '.value.http_port = 3123')"
```

A container that has a `config_override` starts from it again at its next
start: change the port there instead.

**Network access.** The ADE and the `http` container listen on every network
interface (`0.0.0.0`) by default, so other devices on your network can open
them at `http://<this machine's address>:3113` and `:3111`. The ADE also
forwards the engine's WebSocket (`/ws`) without authentication: whoever can
open the ADE can call every function in the project, and public pages have
no authentication either. On a network you do not trust, limit both to this
machine with either option above: `http_host: 127.0.0.1` for the ADE (applied
at its next start) and `host: 127.0.0.1` for `http`. Never expose these
ports through a public proxy or tunnel.
