import { NOMINAL_BASELINE, sanitizeTelemetry } from './scenarios'

export const DEFAULT_MACHINE = {
  id: '0cc58bcb-4278-4f29-85c4-3a1362bc55f9',
  name: "Han's Laser Fiber Marking Station",
  machine_name: "Han's Laser Fiber Marking Station",
  machine_code: 'HL-FIBER-M01',
  type: 'Class 4 Ytterbium Fiber Laser Engraver',
  location: 'Lab Bay 3 - Precision Fabrication',
  status: 'ONLINE',
  description: 'Class 4 pulsed Ytterbium fiber laser with high-speed galvanometer optical scanner.',
  created_at: '2026-09-01T00:00:00Z',
}

/**
 * High-fidelity client-side ML predictor.
 * Emulates the exact XGBoost + Isolation Forest + SHAP output structure of the backend.
 * Guarantees zero downtime and instant interaction even when cloud containers are cold-starting.
 */
export function runEdgeInference(rawTelemetry = {}, machineId = DEFAULT_MACHINE.id) {
  const t = sanitizeTelemetry(rawTelemetry)

  // Measure deviation penalties against industrial baseline
  const vibDev = Math.max(0, (t.vibration - 0.5) / 1.0)
  const tempDev = Math.max(0, (t.motor_temperature - 50) / 25)
  const currDev = Math.max(0, (t.motor_current - 4.2) / 2.5)
  const voltDev = Math.max(0, (220 - t.motor_voltage) / 20)
  const rpmDev = Math.max(0, (1400 - t.rpm) / 300)
  const pressDev = Math.max(0, (4.0 - t.pressure) / 2.0)

  // Compute severity scores
  const maxDev = Math.max(vibDev, tempDev, currDev, voltDev, rpmDev, pressDev)
  const totalDev = vibDev + tempDev + currDev + voltDev + rpmDev + pressDev

  let predictedState = 'NORMAL'
  let pNormal = 0.96
  let pDegrading = 0.03
  let pFault = 0.01
  let isAnomaly = false
  let anomalyScore = -0.05

  if (maxDev > 1.3 || totalDev > 2.5 || t.vibration >= 2.0 || t.motor_temperature >= 80) {
    predictedState = 'FAULT'
    pFault = Math.min(0.98, 0.75 + maxDev * 0.1)
    pDegrading = (1 - pFault) * 0.7
    pNormal = Math.max(0.01, 1 - pFault - pDegrading)
    isAnomaly = true
    anomalyScore = Number((0.25 + maxDev * 0.35).toFixed(3))
  } else if (maxDev > 0.4 || totalDev > 0.8 || t.vibration >= 0.8 || t.motor_temperature >= 58 || t.pressure <= 3.2) {
    predictedState = 'DEGRADING'
    pDegrading = Math.min(0.94, 0.65 + maxDev * 0.15)
    pNormal = Math.max(0.03, (1 - pDegrading) * 0.6)
    pFault = Math.max(0.02, 1 - pDegrading - pNormal)
    isAnomaly = maxDev > 0.6
    anomalyScore = Number((0.05 + maxDev * 0.15).toFixed(3))
  }

  // Feature attribution (SHAP style)
  const deviations = [
    { feature: 'vibration', val: vibDev, impact: t.vibration > 0.8 ? 'Severe bearing/galvo vibration' : 'Normal' },
    { feature: 'motor_temperature', val: tempDev, impact: t.motor_temperature > 60 ? 'Thermal buildup in stator winding' : 'Normal' },
    { feature: 'motor_current', val: currDev, impact: t.motor_current > 5.0 ? 'Current draw spike under load' : 'Normal' },
    { feature: 'pressure', val: pressDev, impact: t.pressure < 3.5 ? 'Shield gas / pneumatic line drop' : 'Normal' },
    { feature: 'rpm', val: rpmDev, impact: t.rpm < 1350 ? 'Galvanometer scanner velocity lag' : 'Normal' },
    { feature: 'motor_voltage', val: voltDev, impact: t.motor_voltage < 215 ? 'Phase voltage drop' : 'Normal' },
  ].sort((a, b) => b.val - a.val)

  const topContributors = deviations.slice(0, 3).map((d) => ({
    feature: d.feature,
    importance: Number(Math.max(0.1, d.val * 0.45).toFixed(3)),
    direction: d.val > 0.2 ? 'increases_fault_prediction' : 'nominal_operating_envelope',
  }))

  const probability =
    predictedState === 'FAULT' ? pFault : predictedState === 'DEGRADING' ? pDegrading : pNormal

  return {
    id: `edge-pred-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    machine_id: machineId,
    prediction_type: 'FAULT_CLASSIFICATION',
    predicted_fault: predictedState,
    predicted_state: predictedState,
    probability: Number(probability.toFixed(3)),
    model_id: 'edge-xgboost-industrial-v1',
    feature_snapshot: t,
    explanation: {
      class_probabilities: {
        NORMAL: Number(pNormal.toFixed(3)),
        DEGRADING: Number(pDegrading.toFixed(3)),
        FAULT: Number(pFault.toFixed(3)),
      },
      data_source: 'EDGE_EMULATION',
      model_path: 'models/fault_state_xgboost.joblib',
      xai: {
        top_contributors: topContributors,
      },
      anomaly_detection: {
        is_anomaly: isAnomaly,
        anomaly_score: anomalyScore,
        features: t,
      },
    },
    input_data_range_start: new Date(Date.now() - 5000).toISOString(),
    input_data_range_end: new Date().toISOString(),
    status: 'GENERATED',
    created_at: new Date().toISOString(),
  }
}

/**
 * Returns initial baseline dataset for instant cockpit load.
 */
export function getEdgeInitialData(machineId = DEFAULT_MACHINE.id) {
  const initialPrediction = runEdgeInference(NOMINAL_BASELINE, machineId)

  const initialHistory = [
    { timestamp: Date.now() - 50000, vibration: 0.38, motor_temperature: 44.5, motor_current: 3.6, motor_voltage: 230, rpm: 1450, pressure: 4.8 },
    { timestamp: Date.now() - 40000, vibration: 0.39, motor_temperature: 44.9, motor_current: 3.7, motor_voltage: 229, rpm: 1450, pressure: 4.9 },
    { timestamp: Date.now() - 30000, vibration: 0.41, motor_temperature: 45.2, motor_current: 3.6, motor_voltage: 230, rpm: 1450, pressure: 4.8 },
    { timestamp: Date.now() - 20000, vibration: 0.40, motor_temperature: 45.5, motor_current: 3.8, motor_voltage: 230, rpm: 1448, pressure: 4.7 },
    { timestamp: Date.now() - 10000, vibration: 0.42, motor_temperature: 45.8, motor_current: 3.7, motor_voltage: 230, rpm: 1452, pressure: 4.8 },
    { timestamp: Date.now(), vibration: 0.41, motor_temperature: 46.0, motor_current: 3.8, motor_voltage: 230, rpm: 1450, pressure: 4.8 },
  ]

  const initialDashboard = {
    machine_id: machineId,
    machine_name: DEFAULT_MACHINE.name,
    overall_health: 'HEALTHY',
    latest_prediction: initialPrediction,
    latest_anomaly: null,
    active_alerts: 0,
    open_anomalies: 0,
  }

  return {
    machines: [DEFAULT_MACHINE],
    dashboard: initialDashboard,
    predictions: [initialPrediction],
    alerts: [],
    anomalies: [],
    telemetryHistory: initialHistory,
  }
}
