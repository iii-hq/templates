# Quickstart

A quickstart example project that shows you how to scaffold a cross-language project, compose Python and TypeScript workers, and incrementally add functionality to a live system with zero downtime.

| Worker          | Language   | Function                | Does                                     |
| --------------- | ---------- | ----------------------- | ---------------------------------------- |
| `math-worker`   | Python     | `math::add`             | Returns `{ c: a + b }`                   |
| `caller-worker` | TypeScript | `math::add_two_numbers` | Calls `math::add` and returns the result |

Continue with the tutorial at: https://iii.dev/docs/quickstart

## All workers demo

This project also contains a small end-to-end proof for the standalone
`http`, `cron`, `queue`, `state`, and `pubsub` workers. Install all five with:

```bash
iii worker add http cron queue state pubsub
```

If the project still uses the legacy built-in `iii-queue`, remove it before
adding the standalone queue because both expose the same trigger type:

```bash
iii worker remove iii-queue
iii worker add queue
```

Start the engine from the project directory:

```bash
iii
```

In another terminal, create a job through the HTTP worker:

```bash
response=$(curl -sS -X POST http://127.0.0.1:3111/worker-demo \
  -H 'content-type: application/json' \
  -d '{"message":"prove all workers"}')
printf '%s\n' "$response" | jq

job_id=$(printf '%s' "$response" | jq -r .job_id)
curl -sS "http://127.0.0.1:3111/worker-demo/$job_id" | jq
```

The final response reaches `status: "completed"` and contains these steps:

```json
{
  "source": "http",
  "status": "completed",
  "steps": ["http", "state", "queue", "pubsub"]
}
```

That single job proves the following behavior:

| Worker | Proof |
| --- | --- |
| `http` | Receives the POST and serves the status endpoint |
| `state` | Stores the job and every status update |
| `queue` | Delivers the job to the durable subscriber |
| `pubsub` | Delivers the completion event to its subscriber |

The cron worker creates a job through the same queue every 30 seconds. After
the next 30-second UTC boundary, inspect its latest job with:

```bash
curl -sS http://127.0.0.1:3111/worker-demo-cron/latest | jq
```

Its response has `source: "cron"`, `status: "completed"`, and steps
`["cron", "state", "queue", "pubsub"]`, proving the fifth worker.
