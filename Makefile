.PHONY: venv py-install api-dev api-test api-lint db-migrate db-upgrade prompt-test prompt-report

VENV := .venv
PYTHON := $(VENV)/bin/python
PIP := $(VENV)/bin/pip

# Python 3.14 doesn't process .pth files from editable installs correctly.
# Explicitly add src directories to PYTHONPATH.
export PYTHONPATH := python/shared/src:python/db/src:python/builder/src:python/codegen/src

venv:
	python3 -m venv $(VENV)

py-install: venv
	$(PIP) install -e python/shared -e python/db -e python/builder -e python/codegen -e "apps/api[dev]"

api-dev:
	$(PYTHON) -m uvicorn apps.api.main:app --reload --port 8000

api-test:
	$(PYTHON) -m pytest apps/api/tests/ -v

api-lint:
	$(PYTHON) -m ruff check apps/api/ python/
	$(PYTHON) -m mypy apps/api/ python/ --ignore-missing-imports

db-migrate:
	cd python/db && ../../$(PYTHON) -m alembic revision --autogenerate -m "$(msg)"

db-upgrade:
	cd python/db && ../../$(PYTHON) -m alembic upgrade head

prompt-test:
	$(PYTHON) -m pytest tests/prompt_suite/ -v --tb=short

prompt-report:
	$(PYTHON) -m tests.prompt_suite.report
