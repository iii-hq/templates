# harness + console: a base compose template

The smallest compose project that gives you a working iii agent harness and the
web console in front of it. Thirteen containers: `harness`, `console`, and the eleven
workers the registry says `harness` needs. Nothing optional, nothing to trim.

Copy this directory, export an API key, run three commands.

## Setup your harness authentication (API Key or Provider Login)

Export the key in the shell you start the compose daemon from:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
export OPENAI_API_KEY=sk-...
```

`worker-compose.yaml` reads them as `${ANTHROPIC_API_KEY:-}` and passes them to
`llm-router`. There is no `.env` file. One working provider is enough: an unset
key still starts its container, which answers with an auth error the first time
the harness calls it.

## Start the engine

```bash
iii
```

## Start the compose worker

In a new terminal from the project directory run:

```bash
iii compose --namespace default
```

## Start the harness via worker-compose.yaml

In another terminal from the project directory run:

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
✓ shell ready (962ms)
✓ session-manager ready (1.2s)
✓ iii-directory ready (1.2s)
✓ llm-router ready (1.7s)
✓ provider-anthropic ready (2.1s)
✓ provider-openai ready (2.1s)
✓ provider-openai-codex ready (2.1s)
✓ context-manager ready (2.0s)
✓ harness ready (6.6s)
✓ console ready (956ms)
up: 13 of 13 changed in 22.8s
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
| 3    | `provider-anthropic`, `provider-openai`, `provider-openai-codex`, `context-manager` | `harness` names both providers explicitly, so both are required even if you use one |
| 4    | `harness`                                                             | The turn loop                                                                       |
| 5    | `console`                                                             | The web UI                                                                          |

## Credentials

Provider keys resolve in the `llm-router` process, not in the provider workers.
They are declared once, under `llm-router`'s `environment` block in
`worker-compose.yaml`, and read from the shell that runs the compose daemon. A
key exported only into another container reads back as `configured: false`.

`worker-compose.yaml` has a ready-to-uncomment container block for every
provider below, plus a matching commented line under `llm-router`. Adding one
is: uncomment the container, uncomment its key on the router, export the key,
restart the compose daemon.

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
