PY := .venv/bin/python
BAKERY := examples/bakery

.PHONY: setup test lint reset receipt demo

setup:
	./setup.sh

lint:
	$(PY) -m ruff check .
	$(PY) -m ruff format --check .

test: lint
	$(PY) -m pytest

# The example bakery: fresh data, an empty log and no receipts.
reset:
	cd $(BAKERY) && ../../$(PY) seed.py && rm -rf logs

# Check the example's log against its records and write one receipt per bill.
receipt:
	cd $(BAKERY) && PYTHONPATH=../.. python3 -m receipts verify

# Start Claude Code in the example with the plugin loaded from this repo.
demo:
	cd $(BAKERY) && claude --plugin-dir ../..
