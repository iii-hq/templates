#!/bin/sh
# Bootstraps and starts the worker. Idempotent, and the one place that knows how:
# Compose's pre_run calls it with --prepare, `run` and the manifest's scripts.start
# call it bare, so every way of adding this folder ends up with a running worker.
set -e
cd "$(dirname "$0")/.."

# Python: the private .venv; else the system python3 when it already has the
# dependencies (a VM image after `install`); else create the .venv.
if [ -x .venv/bin/python ]; then
  PY=.venv/bin/python
elif python3 -c 'import iii, watchfiles' 2>/dev/null; then
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

# Build the page (dist/ui for the ADE, dist/web for HTTP) when it is missing.
if [ ! -f dist/ui/page.js ]; then
  if command -v pnpm >/dev/null 2>&1; then
    (cd ui && pnpm install && pnpm build)
  else
    echo "pnpm not found: the ADE and HTTP pages stay unavailable until ui/ is built" >&2
  fi
fi

if [ "${1:-}" = --prepare ]; then
  exit 0
fi
exec "$PY" -m watchfiles "$PY src/main.py"
