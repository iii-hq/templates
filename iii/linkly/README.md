# Linkly

The scaffold for the [Linkly tutorial](https://iii.dev/docs/next/tutorials/linkly/overview): a link
shortener that grows into a multi-tenant link platform, one worker at a time.

## Two paths

- **[Agentic](https://iii.dev/docs/next/tutorials/linkly/agentic)** builds Linkly with a coding
  agent and a prompt per chapter.
- **[Exploration](https://iii.dev/docs/next/tutorials/linkly/foundations)** builds Linkly by hand,
  one chapter at a time.

## What is in here

| Path | Chapter | Contents |
| --- | --- | --- |
| `worker-compose.yaml` | all | One commented block per chapter. Uncomment the block for the chapter you are on. |
| `link/` | 1, 3, 4, 5, 7 | Short codes, redirects, HTTP endpoints. |
| `analytics/` | 4 | Python worker that counts links per day. |
| `click-streamer/` | 5 | Broadcasts every click to the `clicks` stream. |
| `bulk-importer/` | 6 | Imports a CSV of links over a channel. |
| `channel-client/` | 6 | Script that uploads the CSV. |
| `auth/` | 7 | Gates browser connections. |
| `data/` | 3 | SQLite files. |

Each source file holds the code for every chapter, commented, with the chapter and step above each
block. Uncomment the block the chapter asks for. Where a chapter revises a function, comment the
earlier version out again.

## Start

```bash
iii compose --up
```

That command starts the engine and every worker you have uncommented.
