#!/usr/bin/env python3
"""Bump the iii SDK pins and template versions across the templates repo.

Run automatically from the iii engine release (via repository_dispatch) so the
templates always pin the just-published SDK packages. Can also be run by hand:

    python3 scripts/bump_versions.py --version 0.19.0

Rewrites, in lockstep, every manifest under the templates root:

  * package.json        -> "iii-sdk" / "@iii-dev/observability" dep versions
  * pyproject.toml       -> "iii-sdk==" / "iii-observability==" pins
  * requirements.txt     -> iii-sdk== / iii-observability== pins
  * Cargo.toml           -> iii-sdk = "..." / iii-observability = "..."
  * <template>/template.yaml -> version: / min_iii_version:

A single `--version` applies to every ecosystem. The templates only bump on
stable releases, where the Python PEP 440 version and the semver tag are
identical — so there's no separate Python version to thread through.

Pure rewrite helpers live at module top so they can be unit-tested; the CLI at
the bottom walks the tree and applies them.
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

# Package identifiers per ecosystem. Keep in sync with the templates' manifests.
NODE_PACKAGES = ("iii-sdk", "@iii-dev/observability")
PY_PACKAGES = ("iii-sdk", "iii-observability")
CARGO_PACKAGES = ("iii-sdk", "iii-observability")


def bump_json_dep(text: str, dep_name: str, new_version: str) -> str:
    """Rewrite a `"<dep>": "<version>"` entry in a package.json (any section)."""
    pattern = re.compile(rf'("{re.escape(dep_name)}"\s*:\s*")[^"]*(")')
    return pattern.sub(rf"\g<1>{new_version}\g<2>", text)


def bump_pep440_pin(text: str, dep_name: str, new_version: str) -> str:
    """Rewrite a `<dep>==<version>` or `<dep>>=<version>` pin to `<dep>==<new>`.

    Covers both pyproject.toml quoted entries (`"iii-sdk==0.19.0"`) and bare
    requirements.txt lines (`iii-sdk==0.19.0`). The dep name is anchored so
    `iii-sdk` never matches inside `iii-sdk-extras`.
    """
    pattern = re.compile(rf"(?<![\w.-]){re.escape(dep_name)}\s*(?:==|>=)\s*[0-9][^\s\"',]*")
    return pattern.sub(f"{dep_name}=={new_version}", text)


def bump_cargo_dep(text: str, dep_name: str, new_version: str) -> str:
    """Rewrite a simple `<dep> = "<version>"` Cargo dependency line.

    Only the bare-string form is rewritten; table form
    (`iii-sdk = { version = "..." }`) is handled by the same regex matching the
    embedded version when present.
    """
    simple = re.compile(rf'(^{re.escape(dep_name)}\s*=\s*")[^"]*(")', re.MULTILINE)
    if simple.search(text):
        return simple.sub(rf"\g<1>{new_version}\g<2>", text)
    table = re.compile(
        rf'(^{re.escape(dep_name)}\s*=\s*\{{[^}}\n]*?version\s*=\s*")[^"]*(")',
        re.MULTILINE,
    )
    return table.sub(rf"\g<1>{new_version}\g<2>", text)


def bump_template_yaml(text: str, new_version: str) -> str:
    """Rewrite `version:` and `min_iii_version:` in a template.yaml."""
    for key in ("version", "min_iii_version"):
        text = re.sub(
            rf'(^{key}\s*:\s*)["\']?[^"\'\n]+["\']?',
            rf'\g<1>"{new_version}"',
            text,
            flags=re.MULTILINE,
        )
    return text


def rewrite_file(path: Path, version: str) -> bool:
    """Apply the right rewrites for `path` by filename. Returns True if changed."""
    name = path.name
    original = path.read_text()
    text = original

    if name == "package.json":
        for dep in NODE_PACKAGES:
            text = bump_json_dep(text, dep, version)
    elif name == "pyproject.toml":
        for dep in PY_PACKAGES:
            text = bump_pep440_pin(text, dep, version)
    elif name == "requirements.txt":
        for dep in PY_PACKAGES:
            text = bump_pep440_pin(text, dep, version)
    elif name == "Cargo.toml":
        for dep in CARGO_PACKAGES:
            text = bump_cargo_dep(text, dep, version)
    elif name == "template.yaml":
        text = bump_template_yaml(text, version)
    else:
        return False

    if text != original:
        path.write_text(text)
        return True
    return False


def rewrite_all(root: Path, version: str) -> list[Path]:
    """Walk `root`, rewriting every recognized manifest. Returns changed paths."""
    targets = {"package.json", "pyproject.toml", "requirements.txt", "Cargo.toml", "template.yaml"}
    changed: list[Path] = []
    for path in sorted(root.rglob("*")):
        if path.is_file() and path.name in targets and "node_modules" not in path.parts:
            if rewrite_file(path, version):
                changed.append(path)
    return changed


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--version", required=True, help="release version, e.g. 0.19.0")
    parser.add_argument(
        "--root",
        type=Path,
        default=Path(__file__).resolve().parent.parent / "iii",
        help="templates root to walk (defaults to ./iii)",
    )
    args = parser.parse_args(argv)

    changed = rewrite_all(args.root, args.version)
    if changed:
        print(f"Bumped {len(changed)} file(s) to {args.version}:")
        for p in changed:
            print(f"  {p}")
    else:
        print("No manifests changed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
