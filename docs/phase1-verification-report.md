# Phase 1 Verification Report

Date verified: 2026-08-15/16. Environment: Windows, Docker Desktop 4.86.0,
Python 3.14.7. All items below were actually executed against a live
environment — none are inferred or assumed.

## Results

| # | Check | Result | Notes |
|---|---|---|---|
| 1 | PostgreSQL starts | PASS | `infra-db-1`, healthcheck passing |
| 2 | Mosquitto starts | PASS | Required fixing a real file-permission bug — see below |
| 3 | Both containers healthy | PASS | Confirmed via `docker compose ps` over multiple checks |
| 4 | Alembic migration, clean DB | PASS | Required a SQLAlchemy version bump — see below |
| 5 | Expected tables exist | PASS | All 16 tables + `alembic_version` confirmed via `psql \dt` |
| 6 | FastAPI starts | PASS | Both natively (`uvicorn`) and via Docker |
| 7 | Real `/api/v1/health` call | PASS | Exact JSON body confirmed both ways |
| 8 | pytest suite | PASS | 3/3 — required a missing `pytest.ini` and a stale `psycopg2` reference fix |
| 9 | Docker backend startup | PASS | Required a missing `.dockerignore` and a Dockerfile Python-version fix |
| 10 | No hardcoded secrets | PASS | Verified via grep across the codebase |
| 11 | No invented machine values | PASS | Verified via grep; all thresholds remain nullable/TBD |
| 12 | Files match architecture plan | PASS | All 22 planned directories and 40+ files confirmed present |

## Real bugs found and fixed during verification

These were genuine defects, not hypothetical — each was root-caused from
actual error output before being fixed:

1. **Shell brace-expansion typo** — two early `mkdir -p {a,b,c}` style
   commands silently created a literal directory named `{a,b,c}` instead of
   expanding. Found via a full-tree `find` sweep, fixed in `ml/` and `tests/`.
2. **Mosquitto file permissions** — `mosquitto_passwd` created the password
   file with `600` (owner-only) permissions; Mosquitto's container runs as
   a non-root `mosquitto` user and couldn't read it. Fixed with `chmod 644`.
3. **SQLAlchemy/Python 3.14 incompatibility** — SQLAlchemy 2.0.35 doesn't
   understand Python 3.14's `typing.Union` internals
   (`TypeError: descriptor '__getitem__' requires a 'typing.Union' object`).
   Fixed by upgrading to SQLAlchemy 2.0.52 + Alembic 1.19.1 (pulls in
   `greenlet` as a new transitive dependency).
4. **`psycopg2-binary` has no Python 3.14 wheel** — pip tried to compile it
   from source, which needs `pg_config`/PostgreSQL dev headers, and
   separately a Rust-based dependency (`pydantic-core` at its original
   pin) tried to download and build a Rust toolchain, which failed on a
   DNS error. Fixed by switching to `psycopg[binary]` v3 (has real 3.14
   wheels) and unpinning `pydantic`/`pydantic-settings`/`pandas`/`numpy`/
   `scikit-learn`/`xgboost`/`shap` so pip could resolve versions with
   working 3.14 wheels, then re-pinning to the exact versions that were
   verified to install successfully (`pip freeze` → `requirements.txt`).
5. **Missing `pytest.ini`** — tests import `from app.main import app`,
   which only resolves if `backend/` is on the Python path. Running pytest
   from the project root (the correct, documented way) failed with
   `ModuleNotFoundError: No module named 'app'` until a `pytest.ini` with
   `pythonpath = backend` was added.
6. **Missing `backend/.dockerignore`** — the Docker build context ballooned
   to 600+ MB because `venv/` (hundreds of MB of installed packages) was
   being sent to the Docker daemon on every build, which caused the build
   to crash with `error reading from server: EOF`. Fixed by excluding
   `venv/`, `__pycache__/`, and `.pytest_cache/`.
7. **Dockerfile pinned to Python 3.12** — inconsistent with the verified
   working Python 3.14 environment; updated to `python:3.14-slim`.

## Environment issues encountered (not project bugs)

For completeness — these were real blockers during setup but were caused
by the local Windows environment, not by anything in this project:

- A corrupted global Python 3.11 install (`python.exe` was not a valid
  Win32 application) required using the `py` launcher and, ultimately,
  Python 3.14 instead.
- Windows' `VirtualMachinePlatform` optional feature was disabled, which
  blocked Docker Desktop with a "Virtualization support not detected"
  error even though BIOS-level virtualization was already enabled.
- A transient Docker Desktop daemon/CLI desync (`500 Internal Server
  Error` on `docker version`) resolved itself after a `wsl --shutdown`
  and full Docker Desktop restart.

## Conclusion

All 12 checklist items are genuinely verified. Phase 1 is complete.
