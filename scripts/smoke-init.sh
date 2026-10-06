#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEMPLATE_DIR="${III_TEMPLATE_DIR:-"$ROOT_DIR/iii"}"

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

assert_not_contains() {
  local path="$1"
  local needle="$2"
  if grep -Fq "$needle" "$path"; then
    echo "error: unexpected '$needle' in $path" >&2
    exit 1
  fi
}

assert_no_active_base_image() {
  local path="$1"
  if grep -Eq '^[[:space:]]*base_image:' "$path"; then
    echo "error: runtime.base_image must be commented out by default: $path" >&2
    exit 1
  fi
}

# Every file under a template dir is listed under its files:, so
# `iii project init` and coder::scaffold-worker copy all of it.
assert_all_files_listed() {
  local dir="$1"
  local listed path
  listed="$(sed -n '/^files:/,/^[^ ]/s/^  - //p' "$dir/template.yaml")"
  while IFS= read -r path; do
    if ! grep -qxF "${path#"$dir"/}" <<<"$listed"; then
      echo "error: $path is not listed under files: in $dir/template.yaml" >&2
      exit 1
    fi
  done < <(find "$dir" -type f ! -name template.yaml | sort)
}

static_template_checks() {
  local python="$TEMPLATE_DIR/worker-python"
  local node="$TEMPLATE_DIR/worker-node"
  local node_ade="$TEMPLATE_DIR/worker-node-ade"

  for expected in \
    README.md worker-compose.yaml \
    workers/hello-python/iii.worker.yaml workers/hello-python/pyproject.toml \
    workers/hello-python/src/__init__.py workers/hello-python/src/main.py \
    workers/hello-python/tests/test_main.py; do
    assert_file "$python/$expected"
    assert_contains "$python/template.yaml" "  - $expected"
  done
  assert_file "$python/template.yaml"

  for expected in \
    README.md worker-compose.yaml \
    workers/hello-node/iii.worker.yaml workers/hello-node/package.json \
    workers/hello-node/tsconfig.json workers/hello-node/src/greet.ts \
    workers/hello-node/src/index.ts workers/hello-node/tests/greet.test.ts; do
    assert_file "$node/$expected"
    assert_contains "$node/template.yaml" "  - $expected"
  done
  assert_file "$node/template.yaml"

  assert_no_active_base_image "$python/workers/hello-python/iii.worker.yaml"
  assert_no_active_base_image "$node/workers/hello-node/iii.worker.yaml"
  assert_contains "$python/workers/hello-python/iii.worker.yaml" "#   base_image: docker.io/iiidev/python:latest"
  assert_contains "$node/workers/hello-node/iii.worker.yaml" "#   base_image: docker.io/iiidev/node:latest"
  assert_contains "$python/worker-compose.yaml" "run: \".venv/bin/watchfiles '.venv/bin/python src/main.py'\""
  assert_contains "$node/worker-compose.yaml" "run: npm run start"
  assert_contains "$python/worker-compose.yaml" '      pre_run: |'
  assert_contains "$python/worker-compose.yaml" '        set -e'
  assert_contains "$python/worker-compose.yaml" '        if [ ! -x .venv/bin/python ]; then'
  assert_contains "$python/worker-compose.yaml" '          python3 -m venv .venv'
  assert_contains "$python/worker-compose.yaml" '        .venv/bin/python -m pip install -e .'
  assert_contains "$python/worker-compose.yaml" '      pre_run_timeout: 5m'
  assert_contains "$node/worker-compose.yaml" '      pre_run: npm install'
  assert_contains "$node/worker-compose.yaml" '      pre_run_timeout: 5m'
  assert_contains "$python/README.md" '## Automatic host setup'
  assert_contains "$node/README.md" '## Automatic host setup'
  assert_contains "$node/README.md" 'local `node_modules`'
  assert_contains "$python/README.md" 'remove or comment the complete `scripts:` block'
  assert_contains "$node/README.md" 'remove or comment the complete `scripts:` block'
  assert_not_contains "$python/template.yaml" "the VM reloads"
  assert_contains "$python/template.yaml" 'Compose pre_run creates a private venv'
  assert_contains "$node/template.yaml" 'Compose pre_run installs dependencies'
  assert_not_contains "$python/template.yaml" 'Create the private venv:'
  assert_not_contains "$node/template.yaml" 'cd workers/hello-node && npm install'
  assert_contains "$node/template.yaml" "In terminal 1 from the project root"
  assert_contains "$node/template.yaml" "In terminal 2 from the project root"
  assert_contains "$python/README.md" "In terminal 2, also from the generated project root"
  assert_contains "$node/README.md" "In terminal 2, also from the generated project root"
  assert_contains "$python/README.md" "isolation: libkrun"
  assert_contains "$node/README.md" "isolation: libkrun"
  assert_not_contains "$python/README.md" "starting in a VM"
  assert_not_contains "$node/README.md" "starting in a VM"
  assert_not_contains "$node/template.yaml" "the VM reloads"
  assert_contains "$python/template.yaml" '  dir: workers/hello-python'
  assert_contains "$node/template.yaml" '  dir: workers/hello-node'

  # worker-node-ade. check_worker_templates.py (below) checks its worker:
  # block and that every files: entry exists; these check the rest.
  assert_contains "$TEMPLATE_DIR/template.yaml" "  - worker-node-ade"
  assert_all_files_listed "$node_ade"
  assert_contains "$node_ade/worker-compose.yaml" "    worker: package://http"
  assert_contains "$node_ade/workers/my-worker/package.json" '"@iii-dev/console-ui": "0.2.0"'
  assert_contains "$node_ade/README.md" "http://127.0.0.1:3111/my-worker"
  assert_contains "$node_ade/README.md" "never expose port 3111"
  assert_no_active_base_image "$node_ade/workers/my-worker/iii.worker.yaml"

  if find "$python" "$node" "$node_ade" -type d \( -name .venv -o -name venv -o -name node_modules -o -name __pycache__ -o -name dist \) -print -quit | grep -q .; then
    echo "error: generated dependency or build directory found in new templates" >&2
    exit 1
  fi
  if find "$python" "$node" "$node_ade" -type f \( -name '*.pyc' -o -name '*.pyo' \) -print -quit | grep -q .; then
    echo "error: Python bytecode found in new templates" >&2
    exit 1
  fi

  # Every worker: block (what coder::scaffold-worker copies) points at real
  # files and a real compose container.
  python3 "$ROOT_DIR/scripts/check_worker_templates.py" --root "$TEMPLATE_DIR"
  PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s "$ROOT_DIR/scripts/tests"
}

static_template_checks

# worker-python-ade: coder::scaffold-worker and iii project init copy only the
# files: entries, so every file the template ships must be listed, and nothing
# generated (.venv, node_modules, dist, caches) may ship. The page (ui/, web/)
# is a copy of worker-node-ade's, apart from ui/'s package manifest.
static_python_ade_checks() {
  local ade="$TEMPLATE_DIR/worker-python-ade"
  local node_ade="$TEMPLATE_DIR/worker-node-ade"
  assert_file "$ade/template.yaml"
  assert_contains "$TEMPLATE_DIR/template.yaml" "  - worker-python-ade"
  assert_all_files_listed "$ade"
  assert_no_active_base_image "$ade/workers/my-worker/iii.worker.yaml"
  assert_contains "$ade/workers/my-worker/iii.worker.yaml" "#   base_image: docker.io/iiidev/python:latest"
  assert_contains "$ade/workers/my-worker/pyproject.toml" '"iii-sdk=='
  assert_contains "$ade/workers/my-worker/ui/package.json" '"@iii-dev/console-ui": "0.2.0"'
  assert_file "$ade/workers/my-worker/scripts/start.sh"
  sh -n "$ade/workers/my-worker/scripts/start.sh"
  assert_contains "$ade/workers/my-worker/scripts/start.sh" '(cd ui && pnpm install && pnpm build)'
  assert_contains "$ade/worker-compose.yaml" '      pre_run: "sh scripts/start.sh --prepare"'
  assert_contains "$ade/worker-compose.yaml" '      run: "sh scripts/start.sh"'
  assert_contains "$ade/template.yaml" "  requires: [http]"
  if ! diff -rq --exclude=package.json --exclude=pnpm-workspace.yaml --exclude=node_modules --exclude=dist \
    "$node_ade/workers/my-worker/ui" "$ade/workers/my-worker/ui" ||
    ! diff -rq --exclude=node_modules --exclude=dist \
      "$node_ade/workers/my-worker/web" "$ade/workers/my-worker/web"; then
    echo "error: worker-python-ade ui/ or web/ drifted from worker-node-ade" >&2
    exit 1
  fi
}
static_python_ade_checks

if [[ "${1:-}" == "--static-only" ]]; then
  echo "static template checks passed"
  exit 0
fi

if ! command -v iii >/dev/null 2>&1; then
  echo "error: iii is not installed or not on PATH" >&2
  exit 127
fi

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

echo "Testing iii project init --template harness-kanban"
(
  cd "$TMP_DIR"
  iii project init hk-test -t harness-kanban --skip-iii --template-dir "$TEMPLATE_DIR" </dev/null
)

HK_DIR="$TMP_DIR/hk-test"
for expected in README.md worker-compose.yaml .env .gitignore; do
  assert_file "$HK_DIR/$expected"
done
assert_contains "$HK_DIR/worker-compose.yaml" "worker: package://harness"
assert_contains "$HK_DIR/worker-compose.yaml" "worker: package://kanban"
assert_contains "$HK_DIR/worker-compose.yaml" "env_file: [./.env]"

# The shipped file resolves every package, kanban included.
(
  cd "$HK_DIR"
  iii compose build --file worker-compose.yaml
)

echo "Testing iii project init --template harness"
(
  cd "$TMP_DIR"
  iii project init harness-test -t harness --skip-iii --template-dir "$TEMPLATE_DIR" </dev/null
) | tee "$TMP_DIR/harness-init.log"

HARNESS_DIR="$TMP_DIR/harness-test"

# Every path the template lists under `files:` is copied.
python3 - "$TEMPLATE_DIR/harness/template.yaml" >"$TMP_DIR/harness-files.txt" <<'PYEOF'
import sys

in_files = False
with open(sys.argv[1]) as handle:
    for line in handle:
        if line.startswith("files:"):
            in_files = True
            continue
        if not in_files:
            continue
        body = line.strip()
        if body.startswith("- "):
            print(body[2:].split(" #")[0].strip())
        elif body and not body.startswith("#"):
            break
PYEOF
if [[ ! -s "$TMP_DIR/harness-files.txt" ]]; then
  echo "error: harness/template.yaml lists no files" >&2
  exit 1
fi
while IFS= read -r listed; do
  assert_file "$HARNESS_DIR/$listed"
done <"$TMP_DIR/harness-files.txt"
assert_file "$HARNESS_DIR/.gitignore"

# The two gallery profiles keep their ids (the file names) and show what they
# are for. A single builder does the whole job, so the former specialist
# profiles are no longer shipped.
assert_contains "$HARNESS_DIR/agents/ade-worker-builder.md" "name: Create a tool in the ADE"
assert_contains "$HARNESS_DIR/agents/agent-profile-creator.md" "name: Create a custom agent"
for profile in tech-lead backend-engineer frontend-engineer; do
  assert_absent "$HARNESS_DIR/agents/$profile.md"
done

# Each gallery profile carries its own composer example (it is not inherited),
# within iii-directory's 200-character limit after whitespace collapses, and
# every skill it preloads ships with the template.
for profile in ade-worker-builder agent-profile-creator; do
  python3 - "$HARNESS_DIR/agents/$profile.md" "$HARNESS_DIR/skills" <<'PYEOF'
import os
import re
import sys

path, skills_dir = sys.argv[1], sys.argv[2]
front = open(path).read().split("---\n", 2)[1]
match = re.search(r'^composer_placeholder: "(.*)"$', front, re.M)
if not match:
    sys.exit(f"FAIL: {path} has no composer_placeholder")
value = " ".join(match.group(1).split())
if not value or len(value) > 200:
    sys.exit(f"FAIL: {path} composer_placeholder must be 1-200 characters")
skills = re.search(r'^skills: \[(.*)\]$', front, re.M)
for skill in (skills.group(1).split(",") if skills else []):
    skill = skill.strip().strip('"')
    if skill and not os.path.isfile(os.path.join(skills_dir, skill + ".md")):
        sys.exit(f"FAIL: {path} preloads missing skill {skill}")
PYEOF
done

# Provider keys are connected through the secrets worker, encrypted or as
# env:// references to .env. No container reads .env by itself, and the
# template ships none: secrets creates it when a key is kept there, and it
# stays out of git.
assert_contains "$HARNESS_DIR/worker-compose.yaml" "worker: package://secrets"
assert_not_contains "$HARNESS_DIR/worker-compose.yaml" "env_file:"
assert_absent "$HARNESS_DIR/.env"
if ! grep -qx '.env' "$HARNESS_DIR/.gitignore"; then
  echo "FAIL: harness .gitignore does not ignore .env" >&2
  exit 1
fi

# No model provider ships with the harness: the ADE's setup wizard adds the
# one the user connects.
assert_not_contains "$HARNESS_DIR/worker-compose.yaml" "package://provider-"

# The printed next steps lead to the gallery choice, not to hidden profiles.
assert_contains "$TMP_DIR/harness-init.log" "Create a tool in the ADE"
if grep -Eq 'Tech Lead|engineers' "$TMP_DIR/harness-init.log"; then
  echo "FAIL: harness next steps name hidden profiles" >&2
  exit 1
fi

# The shipped file resolves every package.
(
  cd "$HARNESS_DIR"
  iii compose build --file worker-compose.yaml
)

echo "Testing iii project init --template worker-python"
(
  cd "$TMP_DIR"
  iii project init worker-python-test -t worker-python --skip-iii --template-dir "$TEMPLATE_DIR"
)

WORKER_PYTHON_DIR="$TMP_DIR/worker-python-test"
assert_file "$WORKER_PYTHON_DIR/.iii/project.ini"
assert_file "$WORKER_PYTHON_DIR/worker-compose.yaml"
assert_file "$WORKER_PYTHON_DIR/workers/hello-python/iii.worker.yaml"
assert_file "$WORKER_PYTHON_DIR/workers/hello-python/README.md"
assert_file "$WORKER_PYTHON_DIR/workers/hello-python/pyproject.toml"
assert_file "$WORKER_PYTHON_DIR/workers/hello-python/src/main.py"
assert_file "$WORKER_PYTHON_DIR/workers/hello-python/tests/test_main.py"
assert_absent "$WORKER_PYTHON_DIR/config.yaml"
assert_contains "$WORKER_PYTHON_DIR/worker-compose.yaml" "path://./workers/hello-python"

# The unit tests import only the pure helper, so no venv or iii-sdk is needed.
(
  cd "$WORKER_PYTHON_DIR/workers/hello-python"
  PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=. python3 -m unittest discover -s tests -p 'test_*.py'
)

echo "Testing iii project init --template worker-node"
(
  cd "$TMP_DIR"
  iii project init worker-node-test -t worker-node --skip-iii --template-dir "$TEMPLATE_DIR"
)

WORKER_NODE_DIR="$TMP_DIR/worker-node-test"
assert_file "$WORKER_NODE_DIR/.iii/project.ini"
assert_file "$WORKER_NODE_DIR/worker-compose.yaml"
assert_file "$WORKER_NODE_DIR/workers/hello-node/iii.worker.yaml"
assert_file "$WORKER_NODE_DIR/workers/hello-node/README.md"
assert_file "$WORKER_NODE_DIR/workers/hello-node/package.json"
assert_file "$WORKER_NODE_DIR/workers/hello-node/tsconfig.json"
assert_file "$WORKER_NODE_DIR/workers/hello-node/src/greet.ts"
assert_file "$WORKER_NODE_DIR/workers/hello-node/src/index.ts"
assert_file "$WORKER_NODE_DIR/workers/hello-node/tests/greet.test.ts"
assert_absent "$WORKER_NODE_DIR/config.yaml"
assert_contains "$WORKER_NODE_DIR/worker-compose.yaml" "path://./workers/hello-node"

# The worker must compile against the pinned iii-sdk and its unit tests must pass.
(
  cd "$WORKER_NODE_DIR/workers/hello-node"
  npm install --no-audit --no-fund
  npm run build
  npm test
)

# Init an -ade template, then check the copy: every listed file arrived (the
# template's language_files override keeps .mjs, .css, .html and
# pnpm-workspace.yaml, which the root list would drop), compose points at the
# worker by path, and the shipped file resolves (path worker plus http package).
smoke_ade_template() {
  local id="$1"
  local dir="$TMP_DIR/$id-test"
  local listed worker
  echo "Testing iii project init --template $id"
  (
    cd "$TMP_DIR"
    iii project init "$id-test" -t "$id" --skip-iii --template-dir "$TEMPLATE_DIR" </dev/null
  )
  while IFS= read -r listed; do
    assert_file "$dir/$listed"
  done < <(sed -n '/^files:/,/^[^ ]/s/^  - //p' "$TEMPLATE_DIR/$id/template.yaml")
  worker="$(sed -n 's/^  dir: //p' "$TEMPLATE_DIR/$id/template.yaml")"
  assert_contains "$dir/worker-compose.yaml" "path://./$worker"
  (
    cd "$dir"
    iii compose build --file worker-compose.yaml
  )
}

smoke_ade_template worker-node-ade
smoke_ade_template worker-python-ade

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
