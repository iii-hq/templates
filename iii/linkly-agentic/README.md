# Linkly, agentic path

The scaffold for the [Agentic path](https://iii.dev/docs/next/tutorials/linkly/agentic) of the
Linkly tutorial. You build Linkly with a coding agent: one prompt per chapter, and the agent writes
the code.

The [Exploration path](https://iii.dev/docs/next/tutorials/linkly/foundations) builds the same
system by hand, from a separate scaffold.

## What is in here

| File | Contents |
| --- | --- |
| `worker-compose.yaml` | The agent stack, plus one commented block per chapter. |
| `link/` | A link worker stub. The agent fills in the functions. |
| `.env` | Your provider key. |
| `data/` | SQLite files (Ch. 3 on). |

The agent creates the other workers, `analytics/`, `click-streamer/`, `bulk-importer/`, `auth/`,
as it reaches each chapter.

## Start

1. Add your provider key to `.env`.
2. Start the engine and the agent stack:

   ```bash
   iii compose --up
   ```

3. Add your provider (Anthropic shown; swap the name for yours):

   ```bash
   iii trigger compose::add worker=provider-anthropic
   ```

4. Open the console at [http://127.0.0.1:3113](http://127.0.0.1:3113) and start a session.

Follow the [Agentic path](https://iii.dev/docs/next/tutorials/linkly/agentic) from there.
