#!/usr/bin/env python3
"""Check the `worker:` blocks that make templates scaffoldable by the IDE.

`coder::scaffold-worker` (ide worker, iii-hq/workers) copies the `files:`
entries under a template's `worker.dir` into a project, replaces the
`worker.name` token in paths and contents, and builds a `compose::add` entry
from `containers.<worker.compose>` in the template's worker-compose.yaml.
`iii project init` ignores the block.

For every template listed in the root template.yaml that has a `worker:`
block, this asserts:

  * worker.dir, worker.name and worker.compose are set;
  * worker.dir is an existing directory inside the template, without `..`;
  * worker.name appears in worker.dir;
  * every `files:` entry is relative without `..` and exists, and at least
    one sits under worker.dir;
  * worker.compose is a key under `containers:` in worker-compose.yaml.

Stdlib only, because CI runs the runner's system python3: the reader below
understands just the block forms these manifests use.

    python3 scripts/check_worker_templates.py [--root iii]
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path


def top_level_block(text: str, key: str) -> list[str]:
    """Indented lines under a top-level `key:`, without comments or blank lines."""
    lines: list[str] = []
    inside = False
    for raw in text.splitlines():
        line = raw.split(" #")[0].rstrip()
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        if not line[0].isspace():
            inside = line == f"{key}:"
        elif inside:
            lines.append(line)
    return lines


def block_list(lines: list[str]) -> list[str]:
    """The `- item` entries of a block list."""
    return [line.strip()[2:].strip().strip("'\"") for line in lines if line.strip().startswith("- ")]


def block_map(lines: list[str]) -> dict[str, str]:
    """The `key: value` pairs at the first indentation level of a block."""
    if not lines:
        return {}
    indent = len(lines[0]) - len(lines[0].lstrip())
    pairs: dict[str, str] = {}
    for line in lines:
        if len(line) - len(line.lstrip()) == indent:
            key, _, value = line.strip().partition(":")
            pairs[key] = value.strip().strip("'\"")
    return pairs


def unsafe(path: str) -> bool:
    return path.startswith("/") or ".." in path.split("/")


def check(root: Path) -> tuple[list[str], list[str]]:
    """Return (ids of templates with a worker: block, errors) under `root`."""
    checked: list[str] = []
    errors: list[str] = []
    for tid in block_list(top_level_block((root / "template.yaml").read_text(), "templates")):
        manifest = root / tid / "template.yaml"
        if not manifest.is_file():
            continue  # listed without a directory (worker-bare): nothing to scaffold
        text = manifest.read_text()
        worker = block_map(top_level_block(text, "worker"))
        if not worker:
            continue
        checked.append(tid)
        where = f"{tid}/template.yaml"
        missing = [key for key in ("dir", "name", "compose") if not worker.get(key)]
        if missing:
            errors.append(f"{where}: worker: block is missing {', '.join(missing)}")
            continue
        wdir, name, compose = worker["dir"], worker["name"], worker["compose"]
        if unsafe(wdir) or not (root / tid / wdir).is_dir():
            errors.append(f"{where}: worker.dir {wdir} must be an existing directory inside the template, without '..'")
        if name not in wdir:
            errors.append(f"{where}: worker.name {name} must appear in worker.dir {wdir}")
        files = block_list(top_level_block(text, "files"))
        for entry in files:
            if unsafe(entry):
                errors.append(f"{where}: files entry {entry} must be relative, without '..'")
            elif not (root / tid / entry).is_file():
                errors.append(f"{where}: files entry {entry} does not exist")
        if not any(entry.startswith(wdir + "/") for entry in files):
            errors.append(f"{where}: no files: entry under worker.dir {wdir}")
        compose_file = root / tid / "worker-compose.yaml"
        compose_text = compose_file.read_text() if compose_file.is_file() else ""
        if compose not in block_map(top_level_block(compose_text, "containers")):
            errors.append(f"{where}: worker.compose {compose} is not a key under containers: in worker-compose.yaml")
    return checked, errors


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--root",
        type=Path,
        default=Path(__file__).resolve().parent.parent / "iii",
        help="templates root holding the root template.yaml (defaults to ./iii)",
    )
    args = parser.parse_args(argv)

    checked, errors = check(args.root)
    for error in errors:
        print(f"error: {error}", file=sys.stderr)
    if errors:
        return 1
    print(f"worker: blocks ok: {', '.join(checked) or 'none'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
