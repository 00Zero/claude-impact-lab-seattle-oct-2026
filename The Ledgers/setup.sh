#!/usr/bin/env bash
# One-time setup: virtualenv and dependencies.
set -euo pipefail

if ! command -v python3.12 >/dev/null; then
  echo "Python 3.12 is required. Install it, then rerun ./setup.sh"
  exit 1
fi

python3.12 -m venv .venv
.venv/bin/pip install --quiet --upgrade pip
.venv/bin/pip install --quiet -r requirements-dev.txt

echo "Setup done. Run: make test"
