# Build with agents in the ADE (Agentic Development Environment)

This template starts the iii engine, AI agents, and the ADE: the workspace
where you chat with agents and use the apps and tools they build.

## Get started

You need:

- The iii CLI: `curl -fsSL https://iii.dev/registry/install/iii/latest.sh | sh`
- A project created from this template: `iii project init <name> -t harness`
- An API key for one AI provider, such as Anthropic, OpenAI or DeepSeek
- To create apps and tools: Node.js 22 or later and pnpm 10 or later

Run every command below from the project folder.

### 1. Start the project

```bash
iii compose --up
```

This starts the engine and every worker listed in `worker-compose.yaml`, and
keeps running in the foreground: leave this terminal open. The first run
downloads the workers, so it takes longer than later runs.

### 2. Open the ADE

Open **http://127.0.0.1:3113**, the ADE's default address. On the first
visit it walks you through setup, including connecting your AI provider.

If nothing answers there, the ADE may be using another port. In a second
terminal, from the project folder, run:

```bash
iii call configuration::get id=default-ade
```

Then open `http://127.0.0.1:<http_port>`, using the `http_port` value it
prints.
