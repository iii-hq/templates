# harness + console: a base compose template

The smallest compose project that gives you a working iii agent harness and the
web console in front of it. Twelve containers: `harness`, `console`, and the ten
workers the registry says `harness` needs. Nothing optional, nothing to trim.

Copy this directory, add an API key, run three commands.

## Setup your harness authentication (API Key or Provider Login)

```bash
cp .env.example .env      # then edit .env
chmod 600 .env
```

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

Then open the console at **http://127.0.0.1:3113**. It's all setup and ready for you
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
| 3    | `provider-anthropic`, `provider-openai`, `context-manager`            | `harness` names both providers explicitly, so both are required even if you use one |
| 4    | `harness`                                                             | The turn loop                                                                       |
| 5    | `console`                                                             | The web UI                                                                          |

## Credentials

`.env` is read by `provider-anthropic`, `provider-openai`, `harness`, and any other
`provider-*` you add to `worker-compose.yaml`. Each provider reads its own key from its
own environment.

`worker-compose.yaml` has a ready-to-uncomment container block for every
provider below, each with its variable named in a comment beside it. Adding one
is: uncomment the block, uncomment its key in `.env`, restart the compose daemon.

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
