"""Unit tests for scripts/check_worker_templates.py.

Run from the repository root:

    python3 -m unittest discover -s scripts/tests -v
"""

from __future__ import annotations

import contextlib
import io
import shutil
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from check_worker_templates import check, main  # noqa: E402

ROOT_MANIFEST = """\
templates:
  - worker-node
  # - commented-out
  - plain
  - listed-but-absent

shared_files:
  - source: default-gitignore
    dest: .gitignore

language_files:
  common:
    - 'README*'
    - 'worker-compose.yaml'
  node:
    - 'package.json'
  typescript:
    - '*.ts'
"""

MANIFEST = """\
name: Worker (Node)
requires:
  - typescript
files:
  - README.md
  - worker-compose.yaml
  - workers/hello-node/package.json
  - workers/hello-node/src/index.ts  # entry point

worker:
  dir: workers/hello-node
  name: hello-node
  compose: hello-node

next_steps:
  - 'Call: iii trigger hello-node::greet name=World'
"""

COMPOSE = """\
namespace: default
containers:
  # Host development is the default.
  hello-node:
    worker: path://./workers/hello-node
    scripts:
      run: npm run start

  # console:
  #   worker: package://console
"""


def write(path: Path, text: str = "") -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text)


class CheckWorkerTemplatesTest(unittest.TestCase):
    def setUp(self) -> None:
        self.root = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.root)
        self.template = self.root / "worker-node"
        write(self.root / "template.yaml", ROOT_MANIFEST)
        write(self.template / "template.yaml", MANIFEST)
        write(self.template / "worker-compose.yaml", COMPOSE)
        for name in ("README.md", "workers/hello-node/package.json", "workers/hello-node/src/index.ts"):
            write(self.template / name)
        # No worker: block, so it is not checked even though its file is missing.
        write(self.root / "plain" / "template.yaml", "name: Plain\nfiles:\n  - missing.md\n")

    def edit(self, old: str, new: str) -> None:
        path = self.template / "template.yaml"
        text = path.read_text()
        self.assertIn(old, text)
        path.write_text(text.replace(old, new))

    def assert_error(self, needle: str) -> None:
        _, errors = check(self.root)
        self.assertTrue(any(needle in error for error in errors), errors)

    def test_valid_tree_checks_only_worker_templates(self) -> None:
        self.assertEqual(check(self.root), (["worker-node"], []))

    def test_missing_worker_dir(self) -> None:
        shutil.rmtree(self.template / "workers")
        self.assert_error("worker.dir workers/hello-node must be an existing directory")

    def test_worker_dir_with_dotdot(self) -> None:
        self.edit("  dir: workers/hello-node", "  dir: ../worker-node/workers/hello-node")
        self.assert_error("worker.dir ../worker-node/workers/hello-node must be an existing directory")

    def test_missing_listed_file(self) -> None:
        (self.template / "workers/hello-node/src/index.ts").unlink()
        self.assert_error("files entry workers/hello-node/src/index.ts does not exist")

    def test_files_entry_with_dotdot(self) -> None:
        self.edit("  - workers/hello-node/package.json\n", "  - workers/hello-node/../../escape.json\n")
        self.assert_error("files entry workers/hello-node/../../escape.json must be relative, without '..'")

    def test_absolute_files_entry(self) -> None:
        self.edit("  - README.md\n", "  - /etc/passwd\n")
        self.assert_error("files entry /etc/passwd must be relative, without '..'")

    def test_no_files_under_worker_dir(self) -> None:
        self.edit(
            "  - workers/hello-node/package.json\n  - workers/hello-node/src/index.ts  # entry point\n",
            "",
        )
        self.assert_error("no files: entry under worker.dir workers/hello-node")

    def add_start_script(self) -> None:
        write(self.template / "workers/hello-node/scripts/start.sh")
        self.edit("  - README.md\n", "  - README.md\n  - workers/hello-node/scripts/start.sh\n")

    def test_file_no_language_pattern_matches(self) -> None:
        self.add_start_script()
        self.assert_error("files entry workers/hello-node/scripts/start.sh matches no language_files pattern")

    def test_template_language_files_extend_the_root_ones(self) -> None:
        self.add_start_script()
        self.edit("worker:\n", "language_files:\n  common:\n    - '*.sh'\n\nworker:\n")
        self.assertEqual(check(self.root), (["worker-node"], []))

    def test_language_not_required(self) -> None:
        self.edit("  - typescript\n", "  - python\n")
        self.assert_error("files entry workers/hello-node/src/index.ts matches no language_files pattern")
        self.assert_error("files entry workers/hello-node/package.json matches no language_files pattern")

    def test_compose_key_missing(self) -> None:
        self.edit("  compose: hello-node", "  compose: hello-nod")
        self.assert_error("worker.compose hello-nod is not a key under containers:")

    def test_commented_out_container_does_not_count(self) -> None:
        self.edit("  compose: hello-node", "  compose: console")
        self.assert_error("worker.compose console is not a key under containers:")

    def test_name_token_not_in_dir(self) -> None:
        self.edit("  name: hello-node", "  name: my-worker")
        self.assert_error("worker.name my-worker must appear in worker.dir workers/hello-node")

    def test_missing_key(self) -> None:
        self.edit("  compose: hello-node\n", "")
        self.assert_error("worker: block is missing compose")

    def test_main_exit_status(self) -> None:
        with contextlib.redirect_stdout(io.StringIO()) as out:
            self.assertEqual(main(["--root", str(self.root)]), 0)
        self.assertIn("worker: blocks ok: worker-node", out.getvalue())
        self.edit("  compose: hello-node", "  compose: hello-nod")
        with contextlib.redirect_stderr(io.StringIO()) as err:
            self.assertEqual(main(["--root", str(self.root)]), 1)
        self.assertIn("error: worker-node/template.yaml: worker.compose hello-nod", err.getvalue())


if __name__ == "__main__":
    unittest.main()
