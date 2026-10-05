#!/bin/sh
# Bootstraps and starts the worker. Idempotent, and the one place that knows how:
# Compose's pre_run calls it with --prepare, `run` and the manifest's scripts.start
# call it bare, so every way of adding this folder ends up with a running worker.
set -e
CDPATH= cd -- "$(dirname -- "$0")/.."

# Python: the private .venv; else the system python3 when it has this worker
# installed (a VM image after `install`); else create the .venv.
if [ -x .venv/bin/python ]; then
  PY=.venv/bin/python
elif python3 -c "import importlib.metadata as m; m.distribution('my-worker')" 2>/dev/null; then
  PY=python3
else
  python3 -m venv .venv
  PY=.venv/bin/python
fi

# Install into the .venv only when pyproject.toml changed since the last install.
if [ "$PY" = .venv/bin/python ] && ! [ .venv/.installed -nt pyproject.toml ]; then
  .venv/bin/python -m pip install -q -e .
  touch .venv/.installed
fi

# Build the pages (dist/ui for the ADE, dist/web for HTTP) when any output is
# missing. --prepare fails when the build does; a bare run warns and starts
# without pages.
missing=
for output in dist/ui/page.js dist/ui/styles.css dist/web/index.html dist/web/app.js dist/web/styles.css; do
  [ -f "$output" ] || missing=1
done
if [ -n "$missing" ]; then
  if ! command -v pnpm >/dev/null 2>&1; then
    echo "pnpm not found: the ADE and HTTP pages stay unavailable until ui/ is built" >&2
  elif ! (cd ui && pnpm install && pnpm build); then
    if [ "${1:-}" = --prepare ]; then
      exit 1
    fi
    echo "pnpm install or build failed: the ADE and HTTP pages stay unavailable until ui/ is built" >&2
  fi
fi

if [ "${1:-}" = --prepare ]; then
  exit 0
fi
exec "$PY" scripts/dev.py
