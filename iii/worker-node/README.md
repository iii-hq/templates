# hello-node

A minimal Node/TypeScript worker project with one function, `hello-node::greet`. Development runs on the host by default with dependencies installed into this worker's local `node_modules`. An optional VM flow is documented below for checking the portable bundle recipe before publication.

## Prerequisites

- iii 0.23.0 or newer
- Node.js 20 or newer with npm

The Console container is commented out in `worker-compose.yaml`; `http://127.0.0.1:3113` is available only after you enable that container.

## Automatic host setup

No manual dependency-install step is needed. From the generated project root, run
`iii compose --up`. Before starting the worker, Compose executes
`scripts.pre_run: npm install` from `workers/hello-node`. Dependencies are installed
in that worker's local `node_modules`; no global npm install is used.

The hook runs on each Compose start/restart, not on source reloads performed by
`tsx watch`. Installation may need network access; `pre_run_timeout: 5m` bounds the
hook. If it fails, the worker is not started: inspect the hook error before retrying.

Compose host mode does not run `scripts.install` from `iii.worker.yaml`; that remains
the portable guest/publication recipe. The Compose `scripts.run` command starts
`npm run start`, which resolves the local `tsx` binary. After changing dependencies
in `package.json`, restart only `hello-node` through Compose to rerun the setup.

## Start and call

In terminal 1, from the generated project root, start Compose in the foreground:

```sh
iii compose --up
```

In terminal 2, also from the generated project root, call the worker:

```sh
iii trigger hello-node::greet name=World
```

Expected response:

```json
{ "message": "Hello, World!" }
```

Edit files under `workers/hello-node/src/`. `tsx watch` restarts the host worker after each save.

## Tests and type checking

After the first successful Compose setup, run this from the project root:

```sh
(cd workers/hello-node && npm test && npm run typecheck)
```

The unit test imports the pure `buildGreeting` helper and does not need an engine connection.

## Optional: run this checkout in a VM

Do this before publishing a bundle so the guest install and start recipes are exercised. Compose resolves a non-empty `runtime.base_image` to a VM even when `scripts.run` exists, but remove the host override as well so the test uses the exact manifest `scripts.start` command that a bundle uses.

1. In `workers/hello-node/iii.worker.yaml`, uncomment:

   ```yaml
   runtime:
     base_image: docker.io/iiidev/node:latest
   ```

2. In `worker-compose.yaml`, remove or comment the complete `scripts:` block under `hello-node`, including `pre_run`, `pre_run_timeout`, and `run`. Compose hooks execute on the host even for a VM worker; leaving `pre_run` enabled would unnecessarily prepare host dependencies.
3. Restart only this worker:

   ```sh
   iii trigger compose::restart container=hello-node
   ```

4. Inspect `iii trigger engine::workers::list` and require `isolation: libkrun` for `hello-node`, then call `hello-node::greet` again. If startup fails, inspect the actual Compose logs; do not rely on a mode banner.

The guest runs `npm install` and then the manifest start command. You do not normally need to remove host dependencies. If a platform-specific package is unexpectedly resolved from a shared host `node_modules`, stop this worker, move `node_modules` temporarily outside the worker directory, retry, and restore it before returning to host mode.

To return to host development, comment the `runtime`/`base_image` block, restore the
entire Compose `scripts` block (`pre_run`, `pre_run_timeout`, and `run`), and restart
only `hello-node` with the command above. The hook prepares local dependencies
before the host worker starts.

## Publishing the worker

Publication requires more than this checkout working. Add the repository's private catalog metadata and an explicit bundle `include` list, run the repository's static validator, build the real bundle, and test that packaged artifact in the target VM environment. Static validation checks manifest shape; a checkout VM test checks the source tree; only a real bundle test catches missing `include` files or packaging differences. No new CI gate is implied by this template.

Follow the [new-worker SOP](https://github.com/iii-hq/workers/blob/main/docs/sops/new-worker.md#coming-from-an-iii-init-template-node-and-python) and the [worker manifest reference](https://iii.dev/docs/creating-workers/worker-manifest).
