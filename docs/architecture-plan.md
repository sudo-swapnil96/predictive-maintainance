# Predictive Maintenance Platform — Pre-Implementation Plan

## 0. Contradictions / Ambiguities Found in the Spec (and how I'm resolving them)

1. **"Scalable multi-machine platform" vs. "one specific unverified laser marker."**
   Resolution: build the schema and services generic (machine_type-driven), but ship exactly one seeded machine profile (`TBD` fields) so Phase 1 isn't blocked waiting on hardware docs.

2. **LSTM / RUL / SHAP are all conditioned on "sufficient data," which doesn't exist yet.**
   Resolution: these modules get built as real, callable code paths from day one, but they will return an explicit `INSUFFICIENT_DATA` status object rather than a silent stub or a fabricated number. This satisfies "no placeholder functions that silently do nothing" (§41) while also satisfying "never fake RUL" (§16) — the two aren't actually in conflict once the module returns a typed refusal instead of nothing.

3. **WebSocket/SSE for "real-time" vs. FastAPI + Postgres simplicity.**
   Resolution: SSE, not raw WebSocket. Simpler with FastAPI, unidirectional (dashboard only needs server→client push), and reconnects more gracefully in browsers — matches your "Connection lost" / "last updated Ns ago" requirement without hand-rolled heartbeat logic.

4. **Docker Compose "must work on Windows" + Mosquitto MQTT + Postgres.**
   No real conflict, just noting: I'll pin image versions and avoid host-network mode (which behaves differently on Windows Docker Desktop) so `docker compose up` is portable.

5. **§11 says "compare models using actual validation data" but no labelled fault data exists yet.**
   Resolution: Isolation Forest (unsupervised anomaly detection) is usable immediately, even in simulation. Random Forest / XGBoost / LSTM classification stay code-complete but untrained/unevaluated until you supply a labelled CSV — the UI will say "not yet trained" rather than showing metrics.

## 1. System Architecture

```
PHYSICAL MACHINE (TBD — laser marker, unverified)
        │
SENSORS / MACHINE CONTROLLER (TBD protocol)
        │
EDGE DEVICE (ESP32 or existing controller gateway — TBD)
        │  MQTT (primary) — REST fallback for edge devices that can't hold an MQTT session
        ▼
┌─────────────────────────────────────────────────────────┐
│                     BACKEND (FastAPI)                    │
│                                                            │
│  Ingestion Service  →  Validation  →  Preprocessing        │
│         │                                    │              │
│         ▼                                    ▼              │
│   raw sensor_readings table          feature store (derived) │
│                                                │              │
│                                                ▼              │
│                                        AI/ML Engine           │
│                                    (anomaly / classify / RUL) │
│                                                │              │
│                                                ▼              │
│                                     Prediction + Explainability│
│                                                │              │
│                                                ▼              │
│                                     Maintenance Recommendation │
│                                                │              │
│                                                ▼              │
│                                        Alert Engine            │
└─────────────────────────────────┬──────────────────────────┘
                                   │ REST + SSE
                                   ▼
                         WEB DASHBOARD (React + TS)
```

Three data-source modes feed the **same** ingestion pipeline (this is the key architectural decision — simulation, dataset replay, and real MQTT data all normalize to the identical `sensor_readings` schema before hitting validation, so the ML/prediction code never needs to know or care where a reading came from):

- **SIMULATION MODE** — internal simulator process publishes synthetic MQTT messages
- **DEVELOPMENT/DATASET MODE** — uploaded CSV rows are replayed through ingestion at either real-time or accelerated pace
- **REAL MACHINE MODE** — actual MQTT/REST traffic from the edge device

Every row in `sensor_readings` carries a `source` enum (`REAL`, `SIMULATED`, `DATASET_REPLAY`) — this is what lets the dashboard and reports enforce the "never present simulated as real" rule structurally, not just cosmetically.

## 2. Folder Structure

Matches your §5 spec closely; a few additions noted with `←`:

```
/backend
  /app
    /api          # FastAPI routers, one file per resource
    /core          # config.py (env vars), security.py (JWT/hashing), logging.py ←
    /models        # SQLAlchemy ORM models
    /schemas       # Pydantic request/response schemas
    /services      # business logic (machine service, alert service, etc.)
    /ml            # model wrappers, training pipeline, feature engineering
    /iot           # MQTT client, simulator engine, dataset replay engine
    /database      # session, migrations (Alembic) ←
    /utils
    main.py
  /alembic         # migration versions ←
  requirements.txt

/frontend
  /src
    /components
    /pages
    /services      # API client
    /hooks
    /types
    /utils

/ml
  /datasets
  /notebooks
  /training
  /models          # saved model artifacts + metadata json
  /evaluation

/infra
  docker-compose.yml
  mosquitto/
    mosquitto.conf
    passwd ←        # generated, gitignored

/docs
  architecture.md
  api.md
  database.md
  ml.md
  hardware-integration.md

/tests
  backend
  frontend
  ml
  integration

.env.example ←       # documents every required env var, no real secrets
.gitignore
README.md
```

## 3. Database Schema

Postgres, SQLAlchemy models, Alembic migrations. Key tables (columns abbreviated to the non-obvious ones — full DDL comes in Phase 2):

**machines** — `id, name, machine_code (unique), machine_type, manufacturer(nullable), model(nullable), installation_date(nullable), status, created_at`

**machine_parameters** — per-machine configurable parameter list: `id, machine_id, parameter_key, display_name, unit, enabled(bool), source_type, source_description, sampling_interval_seconds, expected_data_source, normal_min, normal_max, warning_min, warning_max, critical_min, critical_max`. Unique constraint on `(machine_id, parameter_key)`. This table is *how* "not every parameter exists on every machine" (§2) is enforced — the ingestion validator only checks parameters that exist here with `enabled=true`. *(Updated in Phase 2 — see `docs/phase2-verification-report.md`.)*

**sensor_calibrations** *(added Phase 2)* — insert-only calibration history per sensor: `id, sensor_id, calibrated_at, calibrated_by, calibration_method, reference_standard, offset_applied, valid_until, notes, created_at`. Kept as history rather than a single overwritable field on `sensors`, consistent with the traceability requirement in §32.

**sensors** — `id, machine_id, parameter_id (FK), sensor_name, status (CONNECTED/DISCONNECTED/INVALID/STALE), last_seen_at`

**sensor_readings** — `id, machine_id, sensor_id, parameter_key, value, unit, timestamp, quality (VALID/INVALID/MISSING/SUSPECT/SIMULATED), source (REAL/SIMULATED/DATASET_REPLAY)`
  - Indexed on `(machine_id, parameter_key, timestamp)` — this is the hot query path for every chart.

**machine_status** — rolling current-state snapshot per machine (health score, condition, last_updated) — separate from history so the dashboard's "current state" query doesn't scan the readings table.

**anomalies** — `id, machine_id, detected_at, anomaly_score, triggering_parameters (jsonb), model_id, status`

**predictions** — `id, machine_id, prediction_type, predicted_fault, probability, model_id (FK → ai_models), feature_snapshot (jsonb), explanation (jsonb, nullable), input_data_range_start, input_data_range_end, created_at`. **Immutable — insert-only, never UPDATE**, per your §6 requirement. This `feature_snapshot` + `input_data_range` pair is what answers "what data caused this prediction" (§32).

**faults** — confirmed/labelled faults, used as training labels later.

**maintenance_records** — as specified in §22.

**maintenance_recommendations** — generated recommendations linked to an anomaly/prediction id.

**alerts** — `id, machine_id, parameter_key, severity, condition_description, value, threshold, triggered_at, resolved_at(nullable), dedup_key`. `dedup_key` (e.g. hash of machine+parameter+severity) plus a cooldown window is how repeat-alert spam (§21) is prevented at the DB/service layer rather than in the UI.

**ai_models** — `id, model_type, version, training_dataset_id, trained_at, features (jsonb), metrics (jsonb), status (TRAINING/ACTIVE/ARCHIVED/FAILED)`. Rollback (§33) = flipping `status` on two rows.

**model_metrics, datasets, system_logs, users** — as specified, standard structure.

## 4. API Design

Grouped, versioned under `/api/v1`:

```
POST   /auth/login
POST   /auth/refresh

GET    /machines
POST   /machines
GET    /machines/{id}
PATCH  /machines/{id}
GET    /machines/{id}/parameters
PATCH  /machines/{id}/parameters/{param_id}

GET    /machines/{id}/readings?param=&from=&to=&resolution=
GET    /machines/{id}/health
GET    /machines/{id}/status/stream          # SSE

GET    /machines/{id}/predictions?type=&from=&to=
GET    /machines/{id}/anomalies
GET    /machines/{id}/alerts

POST   /datasets                              # upload CSV
GET    /datasets/{id}/preview
POST   /datasets/{id}/mapping                 # column→parameter mapping

POST   /models/train                          # async, returns job id
GET    /models
GET    /models/{id}
POST   /models/{id}/activate                  # rollback target

POST   /maintenance
GET    /maintenance?machine_id=

GET    /reports?machine_id=&from=&to=&format=pdf|csv

POST   /simulator/start
POST   /simulator/stop
GET    /simulator/status
```

All list endpoints paginated. OpenAPI docs auto-generated by FastAPI at `/docs`. Auth via `Authorization: Bearer <JWT>`, role checked per-route via a FastAPI dependency (`require_role("engineer")` etc.).

## 5. ML Architecture

```
ml/training/
  ├── data_loader.py        # loads dataset or DB range, returns raw DataFrame
  ├── validation.py         # shared with backend validation logic — SAME module, imported by both
  ├── preprocessing.py      # missing-value handling, scaling — pipeline object saved via joblib
  ├── feature_engineering.py# rolling mean/std, RMS, rate-of-change
  ├── splitting.py          # time-aware split (no shuffle across time boundaries)
  ├── models/
  │     isolation_forest.py
  │     random_forest.py
  │     xgboost_model.py
  │     lstm_model.py       # only invoked if config.enable_lstm and enough rows
  ├── evaluate.py           # computes real metrics, refuses to output if data insufficient
  └── train_pipeline.py     # orchestrates the above, saves model+pipeline+metadata as a versioned bundle
```

**Critical design point on §10:** the exact same `preprocessing.py` and `feature_engineering.py` modules run in both the training pipeline and the live inference path in `backend/app/ml/`. Backend imports the `ml` package rather than reimplementing feature logic — this is the only way to structurally guarantee "never train with one preprocessing method and predict with another."

**Model bundle** saved to `/ml/models/{model_id}/`: `model.joblib`, `preprocessing_pipeline.joblib`, `feature_list.json`, `metrics.json`, `metadata.json` (training dataset id, date, git-ish version string).

**Explainability:** `shap.TreeExplainer` for Random Forest / XGBoost (native support). For Isolation Forest, feature-level contribution to anomaly score via per-feature deviation from training distribution (a legitimate, standard technique — not SHAP, and the API response says so explicitly rather than mislabeling it). LSTM explainability is out of scope initially; endpoint returns `"explanation unavailable for this model type"` rather than fabricating one.

## 6. Hardware Integration Architecture

```
ESP32 / Controller gateway (TBD which)
    │  publishes to: machines/{machine_id}/telemetry
    │  payload: {machine_id, timestamp, <configurable parameter keys>}
    ▼
Mosquitto broker (TLS + auth, credentials via env vars, never hardcoded)
    ▼
backend/app/iot/mqtt_client.py  (subscriber)
    ▼
Ingestion Service (identical path used by simulator/dataset replay)
```

Payload parameters are matched against each machine's `machine_parameters` table by key — unknown keys are logged and rejected, missing enabled keys mark that reading cycle `MISSING`. No assumption is made about which parameters a given payload contains.

Per §26, `hardware-integration.md` will explicitly document: no laser-source access, no interlock bypass, no direct ESP32-to-high-voltage wiring, isolation/qualified-supervision language, and will scope ESP32 involvement to signal-level sensor taps only — never to actuation or control of the laser.

## 7. Development Plan

Phases 1–15 as you listed them (§43), unchanged — I'll follow that order exactly: architecture → DB → backend APIs → simulator → frontend → dataset/preprocessing → training pipeline → prediction → XAI → maintenance engine → reports → MQTT → tests → Docker → docs. Each phase ends with runnable code, the exact commands to run it, and a verification checklist item from your §44 audit list.

## 8. Configuration / TBD Items

These are `TBD` in the seed config, not blocking, editable later from the Machine Configuration UI once you know them:

- Exact machine model, manufacturer, controller/PLC model
- Communication protocol the controller actually exposes (Modbus? proprietary? does it expose anything at all, or do we need external sensors bolted on?)
- Which of the listed parameters (laser power, cooling flow, etc.) are physically measurable on this machine vs. need external sensors
- Laser power / operating specs, normal ranges, alert thresholds — all left as editable nulls until you have real baseline readings
- Whether ESP32 or an existing industrial gateway is the intended edge device

---

## A few things I need from you before/around Phase 1

Everything else in the spec is resolvable with sensible defaults or TBD placeholders, but these two affect what I build in the next two phases specifically.
