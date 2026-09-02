#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEMPLATE_DIR="${III_TEMPLATE_DIR:-"$ROOT_DIR/iii"}"

if ! command -v iii >/dev/null 2>&1; then
  echo "error: iii is not installed or not on PATH" >&2
  exit 127
fi

assert_file() {
  local path="$1"
  if [[ ! -f "$path" ]]; then
    echo "error: expected file missing: $path" >&2
    exit 1
  fi
}

assert_absent() {
  local path="$1"
  if [[ -e "$path" ]]; then
    echo "error: unexpected path exists: $path" >&2
    exit 1
  fi
}

assert_contains() {
  local path="$1"
  local needle="$2"
  if ! grep -Fq "$needle" "$path"; then
    echo "error: expected '$needle' in $path" >&2
    echo "--- $path ---" >&2
    sed -n '1,120p' "$path" >&2
    exit 1
  fi
}

# `iii worker` was removed in 0.23: worker lifecycle moved to Worker Compose and
# the worker-bare scaffolder is no longer reachable from the CLI. Older channels
# still ship it, and this repo serves templates to both, so the worker-init
# assertions below only run when the installed iii predates the removal.
# A prerelease (0.23.0-rc.N) already has the command removed, so the
# prerelease suffix is stripped before comparing.
worker_init_supported() {
  local version="${1%%-*}"
  local major="${version%%.*}"
  local minor="${version#*.}"
  minor="${minor%%.*}"

  [[ "$major" =~ ^[0-9]+$ && "$minor" =~ ^[0-9]+$ ]] || return 1
  ((major == 0 && minor < 23))
}

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

echo "Using templates: $TEMPLATE_DIR"
echo "Using iii: $(command -v iii)"
III_INSTALLED_VERSION="$(iii --version | tr -d '[:space:]')"
echo "$III_INSTALLED_VERSION"

echo "Testing iii project init"
(
  cd "$TMP_DIR"
  iii project init project-test --skip-iii --template-dir "$TEMPLATE_DIR"
)

PROJECT_DIR="$TMP_DIR/project-test"
assert_file "$PROJECT_DIR/.iii/project.ini"
assert_file "$PROJECT_DIR/worker-compose.yaml"
assert_file "$PROJECT_DIR/.gitignore"
assert_absent "$PROJECT_DIR/config.yaml"
assert_absent "$PROJECT_DIR/iii.worker.yaml"
assert_contains "$PROJECT_DIR/worker-compose.yaml" "namespace: default"

echo "Testing iii project init --template quickstart"
(
  cd "$TMP_DIR"
  iii project init quickstart-test --template quickstart --skip-iii --template-dir "$TEMPLATE_DIR"
)

QUICKSTART_PROJECT_DIR="$TMP_DIR/quickstart-test"
assert_file "$QUICKSTART_PROJECT_DIR/.iii/project.ini"
assert_file "$QUICKSTART_PROJECT_DIR/worker-compose.yaml"
assert_file "$QUICKSTART_PROJECT_DIR/workers/math-worker/iii.worker.yaml"
assert_file "$QUICKSTART_PROJECT_DIR/workers/math-worker/src/math_worker.py"
assert_file "$QUICKSTART_PROJECT_DIR/workers/caller-worker/iii.worker.yaml"
assert_file "$QUICKSTART_PROJECT_DIR/workers/caller-worker/src/worker.ts"
assert_absent "$QUICKSTART_PROJECT_DIR/config.yaml"
assert_contains "$QUICKSTART_PROJECT_DIR/worker-compose.yaml" "namespace: default"
assert_contains "$QUICKSTART_PROJECT_DIR/worker-compose.yaml" "containers: {}"

echo "Testing iii project init --docker"
(
  cd "$TMP_DIR"
  iii project init docker-project --docker --skip-iii --template-dir "$TEMPLATE_DIR"
)

DOCKER_PROJECT_DIR="$TMP_DIR/docker-project"
assert_file "$DOCKER_PROJECT_DIR/Dockerfile"
assert_file "$DOCKER_PROJECT_DIR/docker-compose.yml"
assert_file "$DOCKER_PROJECT_DIR/.env"
assert_contains "$DOCKER_PROJECT_DIR/Dockerfile" "EXPOSE 49134 3111 3112 9464"
assert_contains "$DOCKER_PROJECT_DIR/docker-compose.yml" "iii_data:/app/data"
assert_contains "$DOCKER_PROJECT_DIR/docker-compose.yml" "iii_data:"
assert_contains "$DOCKER_PROJECT_DIR/docker-compose.yml" "9464:9464"

echo "Testing iii project init --template linkly"
(
  cd "$TMP_DIR"
  iii project init linkly-test -t linkly --skip-iii --template-dir "$TEMPLATE_DIR" </dev/null
)

LINKLY_DIR="$TMP_DIR/linkly-test"
for expected in \
  README.md worker-compose.yaml .env .gitignore data/.gitkeep \
  link/iii.worker.yaml link/package.json link/tsconfig.json link/src/index.ts \
  analytics/iii.worker.yaml analytics/requirements.txt analytics/src/main.py \
  click-streamer/iii.worker.yaml click-streamer/package.json click-streamer/src/index.ts \
  bulk-importer/iii.worker.yaml bulk-importer/package.json bulk-importer/src/index.ts \
  auth/iii.worker.yaml auth/package.json auth/src/index.ts \
  channel-client/package.json channel-client/import-links.js; do
  assert_file "$LINKLY_DIR/$expected"
done
assert_absent "$LINKLY_DIR/frontend"
assert_absent "$LINKLY_DIR/config"

# One compose block per chapter, and the Agentic block for the harness.
for chapter in 1 2 3 4 5 6 7; do
  assert_contains "$LINKLY_DIR/worker-compose.yaml" "# Ch. $chapter:"
done

# Chapter 1 is live; every later chapter is commented out.
assert_contains "$LINKLY_DIR/worker-compose.yaml" "worker: path://./link"
assert_contains "$LINKLY_DIR/worker-compose.yaml" "  # database:"

# Every source file carries a tagged block for each chapter that touches it.
assert_contains "$LINKLY_DIR/link/src/index.ts" "// --- Ch. 1 | prelude ---"
assert_contains "$LINKLY_DIR/link/src/index.ts" "// --- Ch. 7 | link::request_delete ---"
assert_contains "$LINKLY_DIR/analytics/src/main.py" "# --- Ch. 4 | analytics::on_link_created ---"
assert_contains "$LINKLY_DIR/click-streamer/src/index.ts" "// --- Ch. 5 | click-streamer::broadcast ---"
assert_contains "$LINKLY_DIR/bulk-importer/src/index.ts" "// --- Ch. 6 | bulk-importer::import_csv ---"
assert_contains "$LINKLY_DIR/auth/src/index.ts" "// --- Ch. 7 | auth::browser ---"
assert_contains "$LINKLY_DIR/channel-client/import-links.js" "// --- Ch. 6 | import-links ---"

# Uncommenting every block leaves a compose file the daemon accepts.
python3 - "$LINKLY_DIR/worker-compose.yaml" >"$TMP_DIR/linkly-all-on.yaml" <<'PYEOF'
import re
import sys

YAML_LINE = re.compile(r"^\s*(-\s|[A-Za-z][\w.#-]*:)")
HEADING = re.compile(r"^\s*# (Ch\. \d+|Agentic path):")

active = False
with open(sys.argv[1]) as handle:
    for line in handle.read().splitlines():
        if HEADING.match(line):
            active = True
            print(line)
            continue
        body = line.lstrip()
        if active and body.startswith("# ") and YAML_LINE.match(body[2:]):
            indent = line[: len(line) - len(body)]
            print(indent + body[2:])
        else:
            print(line)
PYEOF
(
  cd "$LINKLY_DIR"
  cp "$TMP_DIR/linkly-all-on.yaml" ./all-on.yaml
  iii compose build --file all-on.yaml
  rm -f ./all-on.yaml
)

echo "Testing iii project init --template linkly-agentic"
(
  cd "$TMP_DIR"
  iii project init la-test -t linkly-agentic --skip-iii --template-dir "$TEMPLATE_DIR" </dev/null
)

LA_DIR="$TMP_DIR/la-test"
for expected in \
  README.md worker-compose.yaml .env .gitignore data/.gitkeep \
  link/iii.worker.yaml link/package.json link/tsconfig.json link/src/index.ts; do
  assert_file "$LA_DIR/$expected"
done
# The agent builds these; the scaffold ships only the link stub.
assert_absent "$LA_DIR/analytics"
assert_absent "$LA_DIR/click-streamer"
assert_absent "$LA_DIR/auth"

# The link file is a stub: it registers no functions and carries no chapter blocks.
assert_contains "$LA_DIR/link/src/index.ts" "link worker ready"
if grep -q "registerFunction" "$LA_DIR/link/src/index.ts"; then
  echo "FAIL: linkly-agentic link stub already implements functions" >&2
  exit 1
fi

# The agent stack ships live, including the Anthropic and OpenAI providers.
assert_contains "$LA_DIR/worker-compose.yaml" "worker: package://harness"
assert_contains "$LA_DIR/worker-compose.yaml" "env_file: ['./.env']"
assert_contains "$LA_DIR/worker-compose.yaml" "worker: package://provider-anthropic"
assert_contains "$LA_DIR/worker-compose.yaml" "worker: package://provider-openai"

# The shipped file resolves: the agent stack plus the Ch. 1 workers.
(
  cd "$LA_DIR"
  iii compose build --file worker-compose.yaml
)

# `worker init` lives on the `iii-worker` binary, which the `iii` CLI installs
# and manages. Override the path with III_WORKER_BIN.
III_WORKER_BIN="${III_WORKER_BIN:-iii-worker}"

# Worker manifests scaffolded by `iii-worker init` declare a `runtime.base_image`
# and `scripts` block (install/start).
test_worker() {
  local lang="$1"
  local base_image="$2"
  local start_cmd="$3"
  shift 3

  local worker_dir="$TMP_DIR/worker-$lang"
  echo "Testing iii-worker init --language $lang"
  (
    cd "$TMP_DIR"
    "$III_WORKER_BIN" init "worker-$lang" --language "$lang" --skip-iii --template-dir "$TEMPLATE_DIR"
  )

  assert_file "$worker_dir/.iii/worker.ini"
  assert_file "$worker_dir/iii.worker.yaml"
  assert_contains "$worker_dir/.iii/worker.ini" "name=worker-$lang"
  assert_contains "$worker_dir/.iii/worker.ini" "source=init"
  assert_contains "$worker_dir/iii.worker.yaml" "name: worker-$lang"
  assert_contains "$worker_dir/iii.worker.yaml" "base_image: $base_image"
  assert_contains "$worker_dir/iii.worker.yaml" "start: $start_cmd"

  for expected in "$@"; do
    assert_file "$worker_dir/$expected"
  done
}

if worker_init_supported "$III_INSTALLED_VERSION"; then
  test_worker ts docker.io/iiidev/node:latest "npm run start" package.json tsconfig.json src/index.ts
  assert_absent "$TMP_DIR/worker-ts/main.py"
  assert_absent "$TMP_DIR/worker-ts/Cargo.toml"

  test_worker js docker.io/iiidev/node:latest "node --watch src/index.js" package.json src/index.js
  assert_absent "$TMP_DIR/worker-js/tsconfig.json"
  assert_absent "$TMP_DIR/worker-js/main.py"
  assert_absent "$TMP_DIR/worker-js/Cargo.toml"

  test_worker py docker.io/iiidev/python:latest "watchfiles 'python src/main.py'" pyproject.toml src/main.py
  assert_absent "$TMP_DIR/worker-py/package.json"
  assert_absent "$TMP_DIR/worker-py/Cargo.toml"
  assert_absent "$TMP_DIR/worker-py/main.py"

  test_worker rust docker.io/library/rust:slim-bookworm "cargo run --release" Cargo.toml src/main.rs
  assert_absent "$TMP_DIR/worker-rust/package.json"
  assert_absent "$TMP_DIR/worker-rust/main.py"
else
  echo "Skipping iii worker init checks: removed in 0.23 (installed $III_INSTALLED_VERSION)"
fi

echo "init smoke tests passed"
