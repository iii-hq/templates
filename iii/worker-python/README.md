# hello-python

A minimal Python worker project with one function, `hello-python::greet`. Development runs on the host by default, using a virtual environment private to this worker. An optional VM flow is documented below for checking the portable bundle recipe before publication.

## Prerequisites

- iii 0.23.0 or newer
- Python 3.11 or newer, including the standard-library `venv` module

The Console container is commented out in `worker-compose.yaml`; `http://127.0.0.1:3113` is available only after you enable that container.

## Automatic host setup

No manual dependency-install step is needed. From the generated project root, run
`iii compose --up`. Before starting the worker, Compose runs `scripts.pre_run`
from `workers/hello-python`:

```sh
set -e
if [ ! -x .venv/bin/python ]; then
  python3 -m venv .venv
fi
.venv/bin/python -m pip install -e .
```

This creates the worker's private `.venv` only when needed and installs dependencies
inside it, never into the global Python environment. The hook runs on each Compose
start/restart, not on source reloads performed by `watchfiles`. Dependency installation
may need network access; `pre_run_timeout: 5m` bounds the hook. If it fails, the worker
is not started: inspect the hook error before retrying.

Compose host mode does not run `scripts.install` from `iii.worker.yaml`; that remains
the portable guest/publication recipe. The Compose `scripts.run` command uses only
`.venv/bin/watchfiles` and `.venv/bin/python`. After changing `pyproject.toml`, restart
only `hello-python` through Compose to rerun the dependency setup.

## Start and call

In terminal 1, from the generated project root, start Compose in the foreground:

```sh
iii compose --up
```

In terminal 2, also from the generated project root, call the worker:

```sh
iii trigger hello-python::greet name=World
```

Expected response:

```json
{ "message": "Hello, World!" }
```

Edit `workers/hello-python/src/main.py`. `watchfiles` restarts the host worker after each save.

## Tests

After the first successful Compose setup, run this from the project root. The tests
import the pure `build_greeting` helper, so they do not need an engine connection:

```sh
PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=workers/hello-python \
  workers/hello-python/.venv/bin/python -m unittest discover \
  -s workers/hello-python/tests -p 'test_*.py' -v
```

## Optional: run this checkout in a VM

Do this before publishing a bundle so the guest install and start recipes are exercised. Compose resolves a non-empty `runtime.base_image` to a VM even when `scripts.run` exists, but remove the host override as well so the test uses the exact manifest `scripts.start` command that a bundle uses.

1. In `workers/hello-python/iii.worker.yaml`, uncomment:

   ```yaml
   runtime:
     base_image: docker.io/iiidev/python:latest
   ```

2. In `worker-compose.yaml`, remove or comment the complete `scripts:` block under `hello-python`, including `pre_run`, `pre_run_timeout`, and `run`. Compose hooks execute on the host even for a VM worker; leaving `pre_run` enabled would unnecessarily prepare host dependencies.
3. Restart only this worker:

   ```sh
   iii trigger compose::restart container=hello-python
   ```

4. Inspect `iii trigger engine::workers::list` and require `isolation: libkrun` for `hello-python`, then call `hello-python::greet` again. If startup fails, inspect the actual Compose logs; do not rely on a mode banner.

The guest runs `python -m pip install -e .` and then the manifest start command. It does not use `.venv`. You do not normally need to remove host dependencies. If a platform-specific dependency is unexpectedly shared into the guest, stop this worker, move `.venv` temporarily outside the worker directory, retry, and restore it before returning to host mode.

To return to host development, comment the `runtime`/`base_image` block, restore the
entire Compose `scripts` block (`pre_run`, `pre_run_timeout`, and `run`), and restart
only `hello-python` with the command above. The hook recreates the venv if needed
and installs dependencies before the host worker starts.

## Publishing the worker

Publication requires more than this checkout working. Add the repository's private catalog metadata and an explicit bundle `include` list, run the repository's static validator, build the real bundle, and test that packaged artifact in the target VM environment. Static validation checks manifest shape; a checkout VM test checks the source tree; only a real bundle test catches missing `include` files or packaging differences. No new CI gate is implied by this template.

Follow the [new-worker SOP](https://github.com/iii-hq/workers/blob/main/docs/sops/new-worker.md#coming-from-an-iii-init-template-node-and-python) and the [worker manifest reference](https://iii.dev/docs/creating-workers/worker-manifest).
