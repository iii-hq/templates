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

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

echo "Using templates: $TEMPLATE_DIR"
echo "Using iii: $(command -v iii)"
iii --version

echo "Testing iii project init"
(
  cd "$TMP_DIR"
  iii project init project-test --skip-iii --template-dir "$TEMPLATE_DIR"
)

PROJECT_DIR="$TMP_DIR/project-test"
assert_file "$PROJECT_DIR/.iii/project.ini"
assert_file "$PROJECT_DIR/config.yaml"
assert_file "$PROJECT_DIR/.gitignore"
assert_absent "$PROJECT_DIR/iii.worker.yaml"

test_worker() {
  local lang="$1"
  local manifest_kind="$2"
  local entry="$3"
  shift 3

  local worker_dir="$TMP_DIR/worker-$lang"
  echo "Testing iii worker init --language $lang"
  (
    cd "$TMP_DIR"
    iii worker init "worker-$lang" --language "$lang" --skip-iii --template-dir "$TEMPLATE_DIR"
  )

  assert_file "$worker_dir/.iii/worker.ini"
  assert_file "$worker_dir/iii.worker.yaml"
  assert_contains "$worker_dir/.iii/worker.ini" "name=worker-$lang"
  assert_contains "$worker_dir/.iii/worker.ini" "source=init"
  assert_contains "$worker_dir/iii.worker.yaml" "name: worker-$lang"
  assert_contains "$worker_dir/iii.worker.yaml" "kind: $manifest_kind"
  assert_contains "$worker_dir/iii.worker.yaml" "entry: $entry"

  for expected in "$@"; do
    assert_file "$worker_dir/$expected"
  done
}

test_worker ts typescript ./src/index.ts package.json tsconfig.json src/index.ts
assert_absent "$TMP_DIR/worker-ts/main.py"
assert_absent "$TMP_DIR/worker-ts/Cargo.toml"

test_worker js javascript ./src/index.js package.json src/index.js
assert_absent "$TMP_DIR/worker-js/tsconfig.json"
assert_absent "$TMP_DIR/worker-js/main.py"
assert_absent "$TMP_DIR/worker-js/Cargo.toml"

test_worker py python ./main.py pyproject.toml main.py
assert_absent "$TMP_DIR/worker-py/package.json"
assert_absent "$TMP_DIR/worker-py/Cargo.toml"

test_worker rust rust ./src/main.rs Cargo.toml src/main.rs
assert_absent "$TMP_DIR/worker-rust/package.json"
assert_absent "$TMP_DIR/worker-rust/main.py"

echo "init smoke tests passed"
