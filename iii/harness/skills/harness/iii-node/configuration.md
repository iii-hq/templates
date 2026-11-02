---
name: configuration
description: >-
  Schema-validated, reactive registry for named configuration entries — the
  migration target for per-worker config blocks currently in engine/config.yaml.
---

# configuration

The `configuration` worker is a server-side registry of named entries. Every entry has an id (e.g. `iii-stream`, `billing-service`), a human-readable name and description, a JSON Schema describing the value shape, and a JSON value validated against that schema. Workers call `configuration::register` once at startup to declare their schema and `configuration::set` to publish values; consumers call `configuration::get` / `configuration::list` to read and bind a `configuration` trigger to react to changes without polling.

The default `fs` adapter persists one YAML file per id under `./data/configuration` and watches the directory for external edits, so manual edits to those files surface as `configuration:updated` events the same way SDK calls do. The `bridge` adapter delegates to a remote engine and re-broadcasts its events into the local fan-out — the function surface is identical across adapters. The worker is enabled by default in `engine/config.yaml`.

A per-id TTL (off by default) cleans up entries whose last subscriber trigger has unregistered, scoped to the lifecycle of ephemeral workers that come and go without an explicit teardown step.

## When to Use

- A worker is migrating its block out of `engine/config.yaml` and needs a typed, observable surface other workers can read and validate against.
- Two workers need to agree on the same configuration values without one polling the other or hardcoding a path on disk.
- An operator should be able to edit a single YAML file (or the remote control plane) and have the change propagate to every subscriber without a worker restart.
- A worker comes and goes (sandboxes, ephemeral consumers) and its configuration should be cleaned up automatically when no one is left subscribing.

## Boundaries

- Not a general-purpose key/value store — every entry must have a registered JSON Schema. Use `iii-state` for free-form values.
- No partial-update surface; `set` always replaces the whole value. Build the new value client-side and ship it in one call.
- The `bridge` adapter cannot delete entries on the remote engine; cleanup over the bridge happens via TTL or directly on the source engine.
- Schemas are not version-checked across re-registrations — re-registering with an incompatible schema simply replaces it. Coordinate schema migrations out-of-band.

## Functions

- `configuration::register` — declare an id with name, description, JSON Schema, and an optional `initial_value`; idempotent re-registration replaces the schema and metadata.
- `configuration::set` — replace the value for a registered id; validates against the registered schema and emits `configuration:updated`.
- `configuration::get` — read one entry by id; expands `${VAR:default}` against live env unless `raw: true`.
- `configuration::list` — enumerate every registered id with name, description, and schema; never returns the value.
- `configuration::schema` — read schema/name/description for one id without exposing the value.

`register` and `set` are the only mutators; the read-side functions are cache-backed and cheap. Reads expand `${VAR:default}` placeholders against the live process env on every call, so env changes propagate without restarts — pass `raw: true` to `configuration::get` when you need the stored template form.

## Reactive triggers

Bind a `configuration` trigger when a function should run automatically on every register / set / delete — including external `fs` file edits and bridge-forwarded events from a remote engine. The engine invokes matching handlers asynchronously after each successful mutation and after TTL-driven cleanup, so a worker stays in sync with its configuration without polling.

Reach for it when:

- A worker needs to reload in-memory state when its configuration is rewritten by another component or by an operator editing the YAML directly.
- The same handler should run regardless of who edited the configuration (local SDK call, remote engine via the bridge adapter, or a file edit).

If you only need the new value inside the same function that wrote it, `configuration::set` already returns `old_value` / `new_value` — observe `configuration::on-updated` only when a *different* worker should react.

### How to bind

1. Register a handler: `iii.registerFunction('stream::on-config-change', handler)`.
2. Observe `configuration::on-updated`, which takes no `args`; choose the entry and the event with `filters`:

```typescript
iii.observe(
  {
    function_id: 'configuration::on-updated',
    namespace: 'default', // engine-hosted; required when the worker runs in a project namespace
    filters: {
      'input.id': { $eq: 'iii-stream' },                  // omit to receive every id
      'input.event_type': { $eq: 'configuration:updated' }, // or $in over registered | updated | deleted
    },
    deliver: 'input', // the handler receives the event, not the Observed envelope
  },
  'stream::on-config-change',
)
```

Do not pass the 0.25 trigger config (`{ configuration_id, event_types }`) as `args`: `configuration::on-updated` declares no `args_format`, so the engine accepts the observer, ignores the args, and runs the handler for every entry's change.

Calls that fire it: `configuration::register` (`:registered` on first call, `:updated` on re-registration), `configuration::set` (`:updated`), and external `fs` create/edit/delete events (removing `<id>.yaml` replays as `:deleted`). Reads do **not** fire it. An entry persists until its file is removed; `ttl_seconds` is ignored (the worker logs a `warn` when it is not `0`).

For the event payload shape, read `engine::functions::info { function_id: 'configuration::on-updated' }`.
