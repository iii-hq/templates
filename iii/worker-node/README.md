# hello-node

A minimal Node/TypeScript worker project with one function, `hello-node::greet`. Development runs on the host by default with dependencies installed into this worker's local `node_modules`. An optional VM flow is documented below for checking the portable bundle recipe before publication.

## Prerequisites

- iii 0.26.0 or newer
- Node.js 20 or newer with npm

The ADE container is commented out in `worker-compose.yaml`; `http://127.0.0.1:3113` is available only after you enable that container.

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
iii call hello-node::greet name=World
```

Expected response:

```json
{ "message": "Hello, World!" }
```

Edit files under `workers/hello-node/src/`. `tsx watch` restarts the host worker after each save.

## Build

Compose runs the worker from TypeScript source with `tsx`, so no build step is needed for development. To compile to JavaScript, for example to check the output before publishing, run this from the project root:

```sh
(cd workers/hello-node && npm install && npm run build)
```

`tsc` writes the compiled files to `workers/hello-node/dist/`. That directory is ignored by git.

## Tests and type checking

After the first successful Compose setup, run this from the project root:

```sh
(cd workers/hello-node && npm test && npm run typecheck)
```

The unit test imports the pure `buildGreeting` helper and does not need an engine connection.

## Optional: run this checkout in a VM

Do this before publishing a bundle so the guest install and start recipes are exercised. In a VM, Compose builds an image of the worker with the manifest's `scripts.install` (`iii sandbox build`) and boots it with the manifest's `scripts.start` (`iii sandbox run`), the commands a bundle uses. This needs an iii release that has `iii sandbox build`.

1. In `workers/hello-node/iii.worker.yaml`, uncomment:

   ```yaml
   runtime:
     base_image: docker.io/iiidev/node:latest
   ```

2. In `worker-compose.yaml`, remove or comment the complete `scripts:` block under `hello-node`, including `pre_run`, `pre_run_timeout`, and `run`. Compose hooks execute on the host even for a VM worker; leaving `pre_run` enabled would unnecessarily prepare host dependencies. A `run` left in place would keep running, inside the VM, as `iii sandbox run --command '<run>'` instead of the manifest's `scripts.start`.
3. Restart the project so Compose reads the change:

   ```sh
   iii call compose::restart
   ```

   With `runtime.base_image` set and no `scripts.build`, Compose moves the container into a VM. It writes the VM mode into `worker-compose.yaml` and adds the `sandbox-libkrun` container, the adapter that builds and boots the VM:

   ```yaml
     hello-node:
       worker: path://./workers/hello-node
       start_after: [sandbox-libkrun]
       scripts:
         build: iii sandbox build
         run: iii sandbox run
   ```

   The first start builds the image into `.build/hello-node/`, which git ignores; later starts boot it without installing anything. After changing dependencies in `package.json`, run `iii sandbox build hello-node`, then `iii call compose::restart container=hello-node`.

4. Inspect `iii call engine::workers::list` and require `isolation: libkrun` for `hello-node`, then call `hello-node::greet` again. If startup fails, inspect the actual Compose logs; do not rely on a mode banner.

The build and the live sync of your source leave out `node_modules`, so host dependencies never reach the guest.

To return to host development, comment the `runtime`/`base_image` block, replace the VM `scripts` with the
entire host block (`pre_run`, `pre_run_timeout`, and `run`), remove `sandbox-libkrun` from `start_after`,
and restart the project with `iii call compose::restart`. The hook prepares local dependencies
before the host worker starts.

The `sandbox-libkrun` container that Compose added stays in `worker-compose.yaml`, and Compose
keeps starting it. Once no container runs in a VM, remove it:

```sh
iii call compose::remove worker=sandbox-libkrun
```

## Publishing the worker

Publication requires more than this checkout working. Add the repository's private catalog metadata and an explicit bundle `include` list, run the repository's static validator, build the real bundle, and test that packaged artifact in the target VM environment. Static validation checks manifest shape; a checkout VM test checks the source tree; only a real bundle test catches missing `include` files or packaging differences. No new CI gate is implied by this template.

Follow the [new-worker SOP](https://github.com/iii-hq/workers/blob/main/docs/sops/new-worker.md#coming-from-an-iii-init-template-node-and-python) and the [worker manifest reference](https://iii.dev/docs/creating-workers/worker-manifest).
