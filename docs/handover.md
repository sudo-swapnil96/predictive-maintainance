# Predictive Maintenance Platform — Agent Handover Document

**Project Context**: Final-Year Engineering Major Project (Evaluation weight: 120 marks).
**Target Industrial Asset**: Han's Laser Fiber Laser Marking & Engraving Station (Class 4 pulsed Ytterbium fiber laser with high-speed galvanometer optical scanner).

---

## 1. Executive Summary & Repository Structure

* **Root Directory**: `c:\Users\swapnil\Desktop\predictive-maintenance-project\predictive-maintenance`
* **Architecture**:
  * **Backend**: FastAPI (`http://127.0.0.1:8000`), Python 3.14 venv at `backend/venv`
  * **Database**: PostgreSQL 16 on port 5432 (Docker container `infra-db-1`)
  * **Message Broker**: Eclipse Mosquitto MQTT on port 1883 (Docker container `infra-mosquitto-1`)
  * **Frontend**: React + Vite on port 5173 (`http://localhost:5173`)
  * **ML Pipeline**: XGBoost multi-class classifier (`fault_state_xgboost.joblib`), Isolation Forest anomaly detector (`anomaly_detector.joblib`), and SHAP `TreeExplainer` feature attribution.

---

## 2. Current Implementation Status

1. **Backend & Database**:
   - Docker containers running and healthy: `infra-backend-1`, `infra-db-1`, `infra-mosquitto-1`.
   - Health check endpoint `GET /api/v1/health` operational.
   - Prediction endpoint `POST /api/v1/machines/{id}/predict` actively executing XGBoost, Isolation Forest, and SHAP.
   - Automated backend test suite: 8/8 tests passing (`pytest tests/backend -v`).

2. **Frontend Cockpit**:
   - `frontend/src/components/HealthGauge.jsx`: Semi-circular SVG health dial (0–100%).
   - `frontend/src/components/TelemetryCharts.jsx`: Real-time SVG time-series sparklines with warning/critical threshold bands.
   - `frontend/src/components/SimulationStudio.jsx`: 5 preset industrial fault scenarios + live telemetry stream generator.
   - `frontend/src/components/PrognosticsRUL.jsx`: P-F failure progression curve with dynamic RUL countdown.
   - `frontend/src/components/WorkOrders.jsx`: Prescriptive maintenance dispatch with OSHA LOTO safety checklist and printable PDF sheet.
   - `frontend/src/components/VivaDefenseGuide.jsx`: 5-tier Industry 4.0 architecture diagram + 8 viva questions & answers.
   - `frontend/src/components/ThreeLaserTwin.jsx`: Full **WebGL 3D Interactive Model** in Three.js featuring 360° OrbitControls, Disassembly / Exploded-View slider (0% to 100%), and **"AUTO-OPEN & PINPOINT ROOT CAUSE"** mechanism. When triggered, the 3D machine opens its cabinet door / lifts its scan head, zooms into the faulted component, illuminates it with pulsing red/amber emissive glow, hovers a 3D target beacon, and displays an on-screen HUD with physical fault mechanism, SHAP AI attribution, and direct work-order dispatch button!
   - `frontend/src/components/LaserDigitalTwin.jsx`: Cyber-physical twin container featuring dual view modes: `[ 3D INTERACTIVE (AUTO-OPEN & DIAGNOSE) ]` and `[ 2.5D SCHEMATIC & REAL WORKPIECE ABLATION ]` with the 4 real-world marked samples from the lab photos (Watch back, Throttle body, Ear tag, Brass medallion).

---

# 25. IMPORTANT: DIGITAL TWIN 3D MODEL REQUIREMENT

The user specifically wants the **Digital Twin to eventually use a real 3D machine model**, rather than remaining only a CSS-generated illustration.

We previously discussed finding a 3D model based on the machine's actual model number. The user indicated that they have the machine's model number and asked for an internet search to find a suitable 3D model.

However, the exact model was either unavailable or not yet integrated.

### User's decision

The user explicitly said:

> Take any similar-looking model for now.

Therefore, the next agent **does not need to wait for the exact machine model**. A visually similar industrial machine, motor, pump, or mechanical equipment model is acceptable for the initial Digital Twin implementation.

## Planned Technology

The preferred implementation should use:

* React Three Fiber
* Three.js
* GLTF/GLB 3D models

A suitable open 3D model can be integrated into the existing React frontend.

The basic architecture should be:

```text
React Application
        │
        ▼
Digital Twin Page
        │
        ▼
React Three Fiber / Three.js
        │
        ▼
3D GLTF/GLB Machine Model
        │
        ├── Sensor Data
        ├── Machine Health
        ├── Fault Prediction
        └── Anomaly Status
```

## Critical Digital Twin Requirement

The 3D model should **not just be a rotating decorative object**.

It should eventually react to actual machine data.

For example:

### Normal Condition

```text
Machine → Normal operation
Glow → Cyan/blue
Sensors → Normal indicators
```

### Degrading Condition

```text
Machine → Warning state
Affected component → Orange/yellow
```

### Fault Condition

```text
Machine → Critical state
Affected area → Red
Visual effects → Warning pulse
```

### Sensor-Based Visualization

The eventual goal is to map backend data to visual behavior:

```text
High Vibration
      ↓
Highlight rotating/mechanical components

High Motor Temperature
      ↓
Highlight motor housing

Pressure Abnormality
      ↓
Highlight pressure-related section

FAULT Prediction
      ↓
Critical red visual state
```

## Current State

The current Digital Twin page is primarily created using CSS elements such as:

```text
large-twin
twin-glow
twin-body
twin-sensor
sensor-top
sensor-left
sensor-right
sensor-bottom
```

This was intended as a temporary visualization.

### Recommended next step

The next agent should first stabilize the existing frontend and then:

1. Find a suitable industrial machine 3D model.
2. Prefer a GLTF or GLB model for web performance.
3. Integrate it using React Three Fiber.
4. Connect its appearance to live/latest machine data.
5. Preserve the existing futuristic dark UI surrounding the 3D model.

**Important:** Do not remove the Digital Twin functionality while adding Three.js. Replace the temporary CSS visualization gradually and keep the page functional.

The user's long-term vision is a **real interactive Digital Twin**, where the 3D machine visually represents its actual AI prediction, sensor conditions, anomalies, and health status.
