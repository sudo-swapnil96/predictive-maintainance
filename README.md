# Predictive Maintenance Platform

AI-based predictive maintenance system for an industrial machine (target: laser
marking/engraving machine — exact specs TBD, see `docs/architecture-plan.md`
section 8). Supports SIMULATION, DATASET, and REAL MACHINE data modes through
a single ingestion pipeline.

Full design rationale, DB schema, API design, and phase plan:
`docs/architecture-plan.md`.

## Status

**Phase 1 verified complete** (see `docs/phase1-verification-report.md` for the
full item-by-item record): project architecture, backend skeleton, all 16
database tables created via Alembic and confirmed present in a live Postgres
instance, FastAPI health endpoint tested end-to-end both natively and via
Docker, automated test suite passing (3/3), Postgres + Mosquitto + backend
all verified running together under Docker Compose.

No AI/API endpoints beyond `/health` exist yet — those come in later phases.
No machine has been connected yet; all data so far has been from manual
verification steps, not simulation or real sensors.

## Prerequisites (Windows)

- Docker Desktop (with WSL2 backend) — https://www.docker.com/products/docker-desktop/
- Python 3.14 (verified working; this is what `requirements.txt` is pinned
  against — earlier versions were not tested and may hit missing-wheel
  issues with some pinned packages). Only needed if you want to run the
  backend outside Docker.
- Git

## 1. Configure environment variables

```powershell
copy .env.example .env
```

Then edit `.env` and replace the placeholder values:
- `POSTGRES_PASSWORD` — any strong password
- `JWT_SECRET_KEY` — generate one:
  ```powershell
  python -c "import secrets; print(secrets.token_urlsafe(48))"
  ```
- `MQTT_USERNAME` / `MQTT_PASSWORD` — any credentials (used to create the
  Mosquitto password file in step 4)

**Expected result:** a `.env` file exists at the project root with no
`REPLACE_ME` / `changeme` values remaining. This file is gitignored and
must never be committed.

## 2. Start Postgres and Mosquitto

```powershell
docker compose --env-file .env -f infra/docker-compose.yml up -d db mosquitto
```

**Verified result:** two containers named `infra-db-1` and `infra-mosquitto-1`
(the prefix comes from the `infra/` folder name, not the project name — if
your compose file lives somewhere else the prefix will differ). Check with:

```powershell
docker compose --env-file .env -f infra/docker-compose.yml ps
```

Both should show `Up` / `healthy`. If `mosquitto` instead shows
`Restarting`, see step 4 below — it needs a password file before it will
start, and won't run without one.

## 3. Create a Python virtual environment and install backend dependencies

```powershell
cd backend
py -3.14 -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Use `py -3.14` specifically if you have multiple Python versions installed
(`py -0` lists what's registered) — the plain `python` command can resolve
to the wrong interpreter depending on your system's PATH setup. `requirements.txt`
is pinned to exact versions verified working on Python 3.14; installing on
an older Python may fail on packages that don't ship wheels for it.

**Verified result:** pip installs ~60 packages ending in
`Successfully installed ...`. No red `ERROR` lines.

## 4. Generate the Mosquitto password file

Mosquitto refuses to start without this file — create it via a one-off
container (works even while the real `mosquitto` container is crash-looping
without it):

```powershell
docker run --rm -v "${PWD}/infra/mosquitto:/mosquitto/config" eclipse-mosquitto:2 mosquitto_passwd -b -c /mosquitto/config/passwd <MQTT_USERNAME> <MQTT_PASSWORD>
```

Use the same username/password you put in `.env`. **This command creates the
file with `600` (owner-only) permissions, which the container's non-root
`mosquitto` user cannot read — you must loosen it:**

```powershell
docker run --rm -v "${PWD}/infra/mosquitto:/mosquitto/config" eclipse-mosquitto:2 chmod 644 /mosquitto/config/passwd
```

Then restart mosquitto:

```powershell
docker compose --env-file .env -f infra/docker-compose.yml restart mosquitto
docker compose --env-file .env -f infra/docker-compose.yml ps
```

`infra-mosquitto-1` should now show `Up` and stay up (not `Restarting`).

## 5. Run the database migration

From `backend/` with the venv active, set both required env vars for this
shell session (pydantic-settings reads them directly; there's no `.env`
file inside `backend/` itself):

```powershell
$env:DATABASE_URL = "postgresql+psycopg://predmaint:<your-password>@localhost:5432/predictive_maintenance"
$env:JWT_SECRET_KEY = "<the value you generated in step 1>"
alembic revision --autogenerate -m "initial schema"
alembic upgrade head
```

**Verified result for `revision --autogenerate`:** a new file appears in
`backend/alembic/versions/` and the console prints lines like
`Detected added table 'machines'` for each of the 16 tables.

**Verified result for `upgrade head`:** `Running upgrade  -> <revision>, initial schema`
with no errors.

**Verify (adjust the container name if your `infra/` folder is named
differently — see step 2):**

```powershell
docker exec -it infra-db-1 psql -U predmaint -d predictive_maintenance -c "\dt"
```

Should list all 16 tables plus Alembic's own `alembic_version` bookkeeping
table (17 rows total): users, machines, machine_parameters, sensors,
sensor_readings, machine_status, anomalies, predictions, faults,
maintenance_records, maintenance_recommendations, alerts, ai_models,
model_metrics, datasets, system_logs, alembic_version.

## 6. Run the backend

```powershell
uvicorn app.main:app --reload
```

**Verified result:** `Uvicorn running on http://127.0.0.1:8000` with no
tracebacks. Then open http://127.0.0.1:8000/docs — you should see the
FastAPI Swagger UI with one endpoint, `GET /api/v1/health`.

**Verify the health endpoint** (in a second PowerShell window, since the
first is running the server):

```powershell
curl -UseBasicParsing http://127.0.0.1:8000/api/v1/health
```

(Plain `curl` in PowerShell prompts a script-execution security warning
since it's aliased to `Invoke-WebRequest` — `-UseBasicParsing` avoids that.)

**Verified result:**
```json
{"status":"ok","app":"Predictive Maintenance Platform","environment":"development"}
```

## 7. Run the automated tests

A `pytest.ini` at the project root adds `backend/` to the Python path so
`import app.*` resolves correctly — run pytest from the **project root**,
not from inside `backend/`:

```powershell
cd ..
python -m pytest tests/backend -v
```

(If you're already at the project root, skip the `cd ..`.) The dummy values
in `tests/backend/conftest.py` are used automatically — no live database
connection is required for these tests.

**Verified result:** `3 passed` (`test_health_check_returns_ok`,
`test_all_expected_tables_are_registered`,
`test_every_table_ddl_compiles_for_postgresql`).

## 8. Full stack via Docker Compose (once steps 1–5 have been done once)

```powershell
docker compose --env-file .env -f infra/docker-compose.yml up --build
```

**Verified result:** three services (`db`, `mosquitto`, `backend`) start;
backend logs show `Uvicorn running on http://0.0.0.0:8000` and
`Application startup complete`. The build context is kept small by
`backend/.dockerignore` (excludes `venv/` — without it, the build context
can balloon to 600+ MB and cause the build to fail).

## Troubleshooting

- **`alembic: command not found`** — the venv isn't activated. Re-run
  `.\venv\Scripts\Activate.ps1`.
- **`password authentication failed`** — `DATABASE_URL` password doesn't
  match `.env`'s `POSTGRES_PASSWORD`. Note Postgres only sets a user's
  password on first container creation — if you changed `POSTGRES_PASSWORD`
  in `.env` after the `db` container already existed, the old password is
  still what's active. Fix with
  `docker compose --env-file .env -f infra/docker-compose.yml down -v`
  (removes the volume) then bring it back up fresh.
- **Mosquitto stuck `Restarting`, log shows `Unable to open pwfile`** — see
  step 4; the password file is either missing or has `600` permissions the
  container's non-root user can't read.
- **`ModuleNotFoundError: No module named 'app'` when running pytest** —
  make sure you're running `pytest` from the project root (where
  `pytest.ini` lives), not from inside `backend/`.
- **`ModuleNotFoundError: No module named 'psycopg2'` during collection**
  — some stale reference still uses the old `postgresql+psycopg2://` URL
  scheme; this project uses `psycopg` v3, so it should read
  `postgresql+psycopg://` everywhere (`.env`, `conftest.py`, etc).
- **`TypeError: descriptor '__getitem__' requires a 'typing.Union'...`**
  when Alembic loads models — SQLAlchemy older than ~2.0.52 doesn't support
  Python 3.14's typing internals. `requirements.txt` is already pinned past
  this; if you see it, your installed SQLAlchemy is out of date relative to
  the pin (`pip install -r requirements.txt` again).
- **`psycopg2-binary` fails to build with `pg_config not found` or Rust
  toolchain errors** — this means pip is trying to compile a dependency
  from source because no prebuilt wheel exists for your Python version.
  This project avoids the problem entirely by using `psycopg[binary]`
  instead of `psycopg2-binary` — if you're seeing this, check you're
  installing from this project's `requirements.txt` and not an older copy.
- **Docker build fails or hangs with a huge "transferring context" size**
  — `backend/.dockerignore` should exclude `venv/`; if it's missing or the
  context still looks huge (hundreds of MB), that's the cause.
- **Docker Desktop won't start on Windows / "Virtualization support not
  detected"** — check `Get-ComputerInfo -Property "HyperV*"`; if BIOS-level
  virtualization is already on but Docker still fails, check
  `Get-WindowsOptionalFeature -Online -FeatureName VirtualMachinePlatform`
  from an **Administrator** PowerShell — it's commonly `Disabled` even when
  WSL itself is enabled. Enable it with
  `Enable-WindowsOptionalFeature -Online -FeatureName VirtualMachinePlatform -All -NoRestart`
  and reboot.
- **`docker version` / `docker compose` return `500 Internal Server Error`
  even though Docker Desktop's own window shows "Engine running"** — a
  stale CLI-to-daemon connection. Try `wsl --shutdown`, fully quit and
  reopen Docker Desktop, and use a fresh PowerShell window.
- **Port already in use (5432 / 1883 / 8000)** — stop any local
  Postgres/Mosquitto/other API already using that port, or change the
  host-side port mapping in `infra/docker-compose.yml`.

## Safety note

This platform is designed to eventually connect to a real industrial laser
marking/engraving machine. See `docs/hardware-integration.md` (added in a
later phase) before wiring any physical sensor or edge device — it will
never instruct opening the laser source, bypassing interlocks, or modifying
high-voltage wiring.
