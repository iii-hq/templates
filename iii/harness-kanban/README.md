# harness + console + kanban: a compose template

The smallest compose project that gives you a working iii agent harness, the
web console, and a kanban board whose five agent profiles plan, build and
review work as tickets.

## Setup your harness authentication (API Key or Provider Login)

Export the key in the shell you start the compose daemon from:

If you need to provide an API key you can either set one in `.env` or
your environment. Either works.

```bash
export ANTHROPIC_API_KEY=sk-ant-...
export OPENAI_API_KEY=sk-...
```
## Start the compose worker and bring the iii engine up in one command

In a new terminal from the project directory run:

```bash
iii compose --up
```

## Start the harness via worker-compose.yaml

Compose can also be controlled like any other iii worker, for example here's what you
would run if you started `iii compose` without the `--up flag`:

```bash
iii trigger compose::up --namespace default file=./worker-compose.yaml --timeout-ms 300000
```

## Use the harness

Once the harnesses is started you should see output from the `iii compose` daemon like:

```bash
$ iii compose --namespace default
compose serving
  engine: ws://127.0.0.1:49134
  namespace: default
  start a project: iii trigger compose::up --namespace default file=./worker-compose.yaml
[compose] project /Users/tony/iii/projects/testing/compose/harness/worker-compose.yaml loaded into default
✓ state ready (1.4s)
✓ queue ready (1.2s)
✓ cron ready (1.2s)
✓ ide ready (962ms)
✓ session-manager ready (1.2s)
✓ iii-directory ready (1.2s)
✓ llm-router ready (1.7s)
✓ provider-anthropic ready (2.1s)
✓ provider-openai ready (2.1s)
✓ browser ready (2.1s)
✓ context-manager ready (2.0s)
✓ harness ready (6.6s)
✓ ade ready (956ms)
✓ kanban ready (956ms)
up: 14 of 14 changed in 22.8s
```

Once you see that output open the console at **http://127.0.0.1:3113**. It's all setup and ready for you
to start developing iii applications with agentic assistance.

## About this project

The `worker-compose.yaml` file in this project specifies how to start the entire
system that supports the harness.

The first `compose::up` downloads workers into `~/.iii/compose/packages`. After
that they are cached.

### What is in it, and why

| Tier | Containers                                                            | Why                                                                                 |
| ---- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 1    | `state`, `queue`, `cron`, `shell`, `session-manager`, `iii-directory` | Direct `harness` dependencies with no dependencies of their own                     |
| 2    | `llm-router`                                                          | Model routing. Needs `state`                                                        |
| 3    | `provider-anthropic`, `provider-openai`, `context-manager`             | `harness` names both providers explicitly, so both are required even if you use one |
| 4    | `harness`                                                             | The turn loop                                                                       |
| 5    | `ade`                                                                 | The web console                                                                     |
| 6    | `browser`                                                             | Chromium sessions and one-shot fetches (`browser::fetch`) the profiles verify with |
| 7    | `kanban`                                                              | The board, its console pages, and the five agent profiles                           |

## Kanban board and agent profiles

`kanban` keeps tickets, threaded comments and assignments in
`data/kanban/board.json` and injects two console pages: the board at
`#/ext/kanban-board` and a ticket screen at `#/ext/kanban-ticket`. Tickets get
human keys (`KAN-1`), and every mutation is a `kanban::*` function, so the board
can also be driven from the CLI:

```bash
iii trigger kanban::ticket::create title="Search filters persist" priority=high
```

The worker package also carries five agent profiles — `product-manager`,
`tech-lead`, `backend-engineer`, `frontend-engineer`, `ade-worker-designer` —
and the `kanban/*` skills they preload. `iii-directory` downloads them from the
workers registry (`auto_download` is on by default) into `agents/` and
`skills/kanban/`, and the console's agent picker lists them from then on. Pick
Product Manager to turn an idea into tickets and Tech Lead to split and dispatch
a feature; the engineers pick up the tickets assigned to them and move them to
`in_review` when done.

## Credentials

`worker-compose.yaml` has a ready-to-uncomment container block for every
provider below, plus a matching environment variable. Adding one
is: uncomment the worker, set its environment variable, start compose.

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

Three providers authenticate without an API Key. These are experimental.

| Provider                  | How it authenticates                                                                                                                                                                                      |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `provider-claude-code`    | Reads `~/.claude/.credentials.json`, written by the Claude Code CLI when you sign in there                                                                                                                |
| `provider-openai-codex`   | Reads `~/.codex/auth.json`, written by the Codex CLI when you sign in there                                                                                                                               |
| `provider-github-copilot` | A GitHub device flow. Call `iii trigger provider::github-copilot::login::start`, enter the `user_code` it returns at the verification URL, then call `iii trigger provider::github-copilot::login::poll`. |
