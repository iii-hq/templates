"""Run the worker and restart it when src/ or dist/ changes.

`run` (scripts/start.sh) ends here. Unlike `watchfiles <command>`, a worker
that exits on its own ends the loop with its exit code, so Compose sees the
crash and applies the container's restart policy instead of keeping it
"running".
"""

import os
import signal
import subprocess
import sys

from watchfiles import watch

COMMAND = [sys.executable, "src/main.py"]


def end(worker: subprocess.Popen) -> None:
    worker.terminate()
    try:
        worker.wait(5)
    except subprocess.TimeoutExpired:
        worker.kill()
        worker.wait()


def main() -> None:
    signal.signal(signal.SIGTERM, lambda *_: sys.exit(0))
    worker = subprocess.Popen(COMMAND)
    try:
        # Only what the worker runs: watching the whole folder would also see
        # caches and files the worker writes. Empty batches every 500 ms are
        # the chance to notice a crash.
        paths = [p for p in ("src", "dist") if os.path.isdir(p)]
        for changes in watch(*paths, rust_timeout=500, yield_on_timeout=True):
            if worker.poll() is not None:
                sys.exit(worker.returncode if worker.returncode >= 0 else 1)
            if changes:
                end(worker)
                worker = subprocess.Popen(COMMAND)
    except KeyboardInterrupt:
        pass
    finally:
        if worker.poll() is None:
            end(worker)


if __name__ == "__main__":
    main()
