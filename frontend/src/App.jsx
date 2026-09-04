import { useEffect, useState, useRef } from 'react'
import {
  Activity,
  AlertTriangle,
  Award,
  BellRing,
  Bot,
  Box,
  Brain,
  BrainCircuit,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Cpu,
  Download,
  FileText,
  Flame,
  Gauge,
  Info,
  Layers,
  Pause,
  Play,
  Printer,
  RefreshCw,
  RotateCw,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
  Wifi,
  Wrench,
  Zap,
} from 'lucide-react'
import './App.css'
import { HealthGauge } from './components/HealthGauge'
import { TelemetryCharts } from './components/TelemetryCharts'
import { SimulationStudio } from './components/SimulationStudio'
import {
  SCENARIOS,
  NOMINAL_BASELINE,
  sanitizeTelemetry,
  generateStreamJitter,
} from './data/scenarios'
import { PrognosticsRUL } from './components/PrognosticsRUL'
import { WorkOrders } from './components/WorkOrders'
import { VivaDefenseGuide } from './components/VivaDefenseGuide'
import { LaserDigitalTwin } from './components/LaserDigitalTwin'

const API_URL = 'http://127.0.0.1:8000/api/v1'
const DEFAULT_MACHINE_ID = '9c5159c2-cb21-4998-869a-f6ac43901737'
const REFRESH_DELAY = 1000

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const formatFeatureName = (feature = '') =>
  String(feature)
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())

const formatDate = (value) => {
  if (!value) return 'No timestamp'
  try {
    return new Date(value).toLocaleString()
  } catch {
    return String(value)
  }
}

const getResponseArray = (data) => {
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.value)) return data.value
  if (Array.isArray(data?.items)) return data.items
  return []
}

function App() {
  // =========================================================
  // STATE MANAGEMENT
  // =========================================================
  const [machineId, setMachineId] = useState(DEFAULT_MACHINE_ID)
  const [machines, setMachines] = useState([])
  const [dashboard, setDashboard] = useState(null)
  const [predictions, setPredictions] = useState([])
  const [alerts, setAlerts] = useState([])
  const [anomalies, setAnomalies] = useState([])

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const [actionSuccess, setActionSuccess] = useState(null)

  const [activePage, setActivePage] = useState('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(true)

  // Global persistent simulation streaming state
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamIntervalMs, setStreamIntervalMs] = useState(2000)
  const [streamCount, setStreamCount] = useState(0)
  const streamRef = useRef(null)
  const currentFeaturesRef = useRef(NOMINAL_BASELINE)

  // Real-time telemetry history buffer for time-series sparklines
  const [telemetryHistory, setTelemetryHistory] = useState([
    { timestamp: Date.now() - 50000, vibration: 0.38, motor_temperature: 44.5, motor_current: 3.6, motor_voltage: 230, rpm: 1450, pressure: 4.8 },
    { timestamp: Date.now() - 40000, vibration: 0.39, motor_temperature: 44.9, motor_current: 3.7, motor_voltage: 229, rpm: 1450, pressure: 4.9 },
    { timestamp: Date.now() - 30000, vibration: 0.41, motor_temperature: 45.2, motor_current: 3.6, motor_voltage: 230, rpm: 1450, pressure: 4.8 },
    { timestamp: Date.now() - 20000, vibration: 0.40, motor_temperature: 45.5, motor_current: 3.8, motor_voltage: 230, rpm: 1448, pressure: 4.7 },
    { timestamp: Date.now() - 10000, vibration: 0.42, motor_temperature: 45.8, motor_current: 3.7, motor_voltage: 230, rpm: 1452, pressure: 4.8 },
    { timestamp: Date.now(), vibration: 0.41, motor_temperature: 46.0, motor_current: 3.8, motor_voltage: 230, rpm: 1450, pressure: 4.8 },
  ])

  // =========================================================
  // API FETCHERS
  // =========================================================
  const fetchMachines = async () => {
    try {
      const response = await fetch(`${API_URL}/machines`)
      if (!response.ok) {
        throw new Error(`Unable to load machines (${response.status})`)
      }
      const data = await response.json()
      setMachines(getResponseArray(data))
    } catch (err) {
      console.error('Machine fetch error:', err)
    }
  }

  const fetchDashboard = async () => {
    const response = await fetch(`${API_URL}/machines/${machineId}/dashboard`)
    if (!response.ok) {
      throw new Error(`Unable to load dashboard (${response.status})`)
    }
    const data = await response.json()
    setDashboard(data)
    return data
  }

  const fetchPredictions = async () => {
    const response = await fetch(
      `${API_URL}/machines/${machineId}/predictions?limit=50`
    )
    if (!response.ok) {
      throw new Error(`Unable to load predictions (${response.status})`)
    }
    const data = await response.json()
    const arr = getResponseArray(data)
    setPredictions(arr)

    // Sync latest prediction features with history
    if (arr[0]?.feature_snapshot) {
      setTelemetryHistory((prev) => {
        const item = { ...arr[0].feature_snapshot, timestamp: Date.now() }
        const last = prev[prev.length - 1]
        if (last && last.vibration === item.vibration && last.motor_temperature === item.motor_temperature) {
          return prev
        }
        return [...prev, item].slice(-30)
      })
    }
  }

  const fetchAlerts = async () => {
    const response = await fetch(
      `${API_URL}/machines/${machineId}/alerts?limit=50`
    )
    if (!response.ok) {
      throw new Error(`Unable to load alerts (${response.status})`)
    }
    const data = await response.json()
    setAlerts(getResponseArray(data))
  }

  const fetchAnomalies = async () => {
    const response = await fetch(
      `${API_URL}/machines/${machineId}/anomalies?limit=50`
    )
    if (!response.ok) {
      throw new Error(`Unable to load anomalies (${response.status})`)
    }
    const data = await response.json()
    setAnomalies(getResponseArray(data))
  }

  const loadAllData = async () => {
    await Promise.all([
      fetchDashboard(),
      fetchPredictions(),
      fetchAlerts(),
      fetchAnomalies(),
    ])
  }

  // Initial load
  useEffect(() => {
    const initialize = async () => {
      try {
        setLoading(true)
        setError(null)
        await Promise.all([fetchMachines(), loadAllData()])
      } catch (err) {
        console.error('Initialization error:', err)
        setError(
          err.message || 'Unable to connect to the predictive maintenance system.'
        )
      } finally {
        setLoading(false)
      }
    }
    initialize()
  }, [])

  // Machine change
  useEffect(() => {
    if (!machineId) return
    const loadMachineData = async () => {
      try {
        setLoading(true)
        setError(null)
        await loadAllData()
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    loadMachineData()
  }, [machineId])

  // Manual Refresh
  const refreshEverything = async () => {
    try {
      setRefreshing(true)
      setError(null)
      setActionSuccess(null)
      const startTime = Date.now()
      await Promise.all([fetchMachines(), loadAllData()])
      const elapsed = Date.now() - startTime
      const remaining = Math.max(0, REFRESH_DELAY - elapsed)
      if (remaining > 0) await delay(remaining)
      setActionSuccess('Telemetry refreshed successfully')
      setTimeout(() => setActionSuccess(null), 3000)
    } catch (err) {
      console.error('Refresh error:', err)
      setError(err.message || 'Unable to refresh system data.')
    } finally {
      setRefreshing(false)
    }
  }

  // Resolve Alert
  const resolveAlert = async (alertId) => {
    try {
      setError(null)
      const response = await fetch(
        `${API_URL}/machines/${machineId}/alerts/${alertId}/resolve`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )

      if (!response.ok) {
        throw new Error(`Unable to resolve alert (${response.status})`)
      }

      await Promise.all([fetchAlerts(), fetchDashboard()])
      setActionSuccess('Alert marked as resolved')
      setTimeout(() => setActionSuccess(null), 3500)
    } catch (err) {
      console.error('Alert resolution error:', err)
      setError(err.message || 'Unable to resolve alert.')
    }
  }

  // Execute Direct Simulation Step with Optimistic State Sync
  const executeSimulationStep = async (telemetryData, sourceLabel = 'SIMULATION') => {
    const payload = sanitizeTelemetry(telemetryData)
    try {
      setError(null)
      const response = await fetch(`${API_URL}/machines/${machineId}/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        throw new Error(`Inference engine rejected payload (${response.status})`)
      }

      const data = await response.json()

      // Optimistically place the latest prediction at top of array
      setPredictions((prev) => [data, ...prev.filter((p) => p.id !== data.id)])

      // Record telemetry into sparkline history
      setTelemetryHistory((prev) => [...prev, { ...payload, timestamp: Date.now() }].slice(-30))

      // Refresh auxiliary metrics in background without blocking
      fetchDashboard().catch(() => {})
      fetchAlerts().catch(() => {})
      fetchAnomalies().catch(() => {})

      currentFeaturesRef.current = payload

      if (sourceLabel !== 'LIVE STREAM') {
        setActionSuccess(`Simulated ${sourceLabel} -> Classified: ${data.predicted_fault}`)
        setTimeout(() => setActionSuccess(null), 3500)
      }

      return data
    } catch (err) {
      console.error('Simulation step error:', err)
      setError(err.message || 'Simulation execution failed.')
      throw err
    }
  }

  // Execute Direct Scenario Injection from Dashboard
  const executeQuickScenario = async (scenario) => {
    try {
      const sanitized = sanitizeTelemetry(scenario.values)
      await executeSimulationStep(sanitized, scenario.name)
    } catch (err) {
      setError(err.message || 'Failed to inject scenario.')
    }
  }

  // Global persistent streaming ticker
  const sendGlobalStreamTick = async () => {
    try {
      const nextParams = generateStreamJitter(currentFeaturesRef.current)
      setStreamCount((c) => c + 1)
      await executeSimulationStep(nextParams, 'LIVE STREAM')
    } catch {
      // Ignored to prevent halting live stream on transient error
    }
  }

  const toggleGlobalStreaming = () => {
    if (isStreaming) {
      if (streamRef.current) clearInterval(streamRef.current)
      streamRef.current = null
      setIsStreaming(false)
      setActionSuccess('Simulation stream paused.')
      setTimeout(() => setActionSuccess(null), 2500)
    } else {
      setIsStreaming(true)
      setActionSuccess(`Live simulation stream active (every ${streamIntervalMs / 1000}s)...`)
      setTimeout(() => setActionSuccess(null), 2500)

      sendGlobalStreamTick()
      streamRef.current = setInterval(() => {
        sendGlobalStreamTick()
      }, streamIntervalMs)
    }
  }

  // Clean up global streaming on unmount or machine change
  useEffect(() => {
    return () => {
      if (streamRef.current) clearInterval(streamRef.current)
    }
  }, [machineId])

  const selectMachine = (id) => {
    setMachineId(id)
    setActivePage('dashboard')
  }

  // =========================================================
  // DERIVED DATA & INTELLIGENCE
  // =========================================================
  const latestPrediction = predictions[0] || dashboard?.latest_prediction || null
  const latestAnomaly = anomalies[0] || dashboard?.latest_anomaly || null

  const currentFeatures =
    latestPrediction?.feature_snapshot ||
    latestPrediction?.explanation?.anomaly_detection?.features ||
    telemetryHistory[telemetryHistory.length - 1] ||
    NOMINAL_BASELINE

  useEffect(() => {
    if (currentFeatures && Object.keys(currentFeatures).length > 0) {
      currentFeaturesRef.current = currentFeatures
    }
  }, [currentFeatures])

  const predictionState =
    latestPrediction?.predicted_state ||
    latestPrediction?.predicted_fault ||
    dashboard?.latest_prediction?.predicted_state ||
    'NORMAL'

  const rawProbability =
    latestPrediction?.probability !== undefined && latestPrediction?.probability !== null
      ? Number(latestPrediction.probability)
      : dashboard?.latest_prediction?.probability !== undefined &&
        dashboard?.latest_prediction?.probability !== null
      ? Number(dashboard.latest_prediction.probability)
      : 0.95

  const confidence = (rawProbability * 100).toFixed(2)
  const health = dashboard?.overall_health || 'HEALTHY'

  const machineName =
    dashboard?.machine_name ||
    machines.find((m) => m.id === machineId)?.machine_name ||
    machines.find((m) => m.id === machineId)?.name ||
    'Phase3 Test Machine'

  const openAnomalies =
    dashboard?.open_anomalies ??
    anomalies.filter((item) => item.status === 'OPEN' || item.status === 'ANOMALY').length

  const activeAlerts =
    dashboard?.active_alerts ??
    alerts.filter((item) => !item.resolved && !item.resolved_at).length

  // Calculate machine health score (0 - 100)
  const calculateHealthScore = () => {
    if (predictionState === 'FAULT' || health === 'CRITICAL') {
      return Math.max(8, Math.round(28 - activeAlerts * 4 - openAnomalies * 2))
    }
    if (predictionState === 'DEGRADING' || health === 'WARNING') {
      return Math.max(35, Math.round(68 - activeAlerts * 6 - openAnomalies * 3))
    }
    return Math.max(78, Math.round(98 - activeAlerts * 4 - openAnomalies * 2))
  }

  const healthScore = calculateHealthScore()

  // Fault diagnosis logic
  const getFaultDiagnosis = (pred) => {
    if (!pred) {
      return {
        type: 'SYSTEM READY / MONITORING',
        severity: 'NORMAL',
        description: 'Machine is active and streaming sensor telemetry to the predictive engine.',
      }
    }

    const state = pred.predicted_state || pred.predicted_fault || 'NORMAL'
    if (state === 'NORMAL') {
      return {
        type: 'OPTIMAL OPERATION',
        severity: 'LOW',
        description:
          'All mechanical and electrical telemetry parameters operate within nominal thresholds.',
      }
    }

    const explanation = pred.explanation || {}
    const xai = explanation.xai || {}
    const contributors = Array.isArray(xai.top_contributors) ? xai.top_contributors : []
    const snapshot =
      pred.feature_snapshot || explanation?.anomaly_detection?.features || {}

    const vibration = Number(snapshot.vibration) || 0
    const temperature = Number(snapshot.motor_temperature) || 0
    const pressure = Number(snapshot.pressure) || 0

    const primary =
      contributors.find((item) => item.direction === 'increases_fault_prediction') ||
      contributors[0]

    if (primary?.feature === 'vibration') {
      if (temperature >= 60) {
        return {
          type: 'BEARING & MECHANICAL DEGRADATION',
          severity: 'CRITICAL',
          description:
            'Severe vibration coupled with elevated winding temperature indicates bearing race wear, shaft misalignment, or rotor unbalance.',
        }
      }
      return {
        type: 'MECHANICAL VIBRATION ANOMALY',
        severity: state === 'FAULT' ? 'CRITICAL' : 'MEDIUM',
        description:
          'Abnormal vibration signature identified. Inspect bearing housings, flexible couplings, and mounting base rigidity.',
      }
    }

    if (primary?.feature === 'motor_temperature') {
      return {
        type: 'MOTOR STATOR OVERHEATING',
        severity: state === 'FAULT' ? 'CRITICAL' : 'MEDIUM',
        description:
          'Motor temperature significantly exceeds thermal baseline. Check cooling fans, ambient ventilation, and high continuous electrical load.',
      }
    }

    if (primary?.feature === 'pressure') {
      return {
        type: 'HYDRAULIC / PRESSURE SYSTEM FAULT',
        severity: state === 'FAULT' ? 'CRITICAL' : 'MEDIUM',
        description:
          'Abnormal system pressure detected. Inspect delivery lines for blockages, fluid cavitations, or seal leaks.',
      }
    }

    if (primary?.feature === 'rpm') {
      return {
        type: 'ROTATIONAL SPEED INSTABILITY',
        severity: state === 'FAULT' ? 'CRITICAL' : 'MEDIUM',
        description:
          'Drive velocity fluctuation detected. Verify VFD frequency regulation, belt tension, and shaft load dynamics.',
      }
    }

    if (primary?.feature === 'motor_voltage' || primary?.feature === 'motor_current') {
      return {
        type: 'ELECTRICAL POWER / LOAD ANOMALY',
        severity: state === 'FAULT' ? 'CRITICAL' : 'MEDIUM',
        description:
          'Abnormal electrical parameters detected. Inspect phase balance, winding insulation resistance, and power supply harmonics.',
      }
    }

    if (vibration >= 0.7 && temperature >= 60) {
      return {
        type: 'BEARING / ROTATING ASSEMBLY FAULT',
        severity: 'CRITICAL',
        description:
          'High vibration and elevated temperature indicate impending mechanical bearing distress.',
      }
    }

    if (state === 'FAULT') {
      return {
        type: 'CRITICAL MACHINE FAULT',
        severity: 'CRITICAL',
        description:
          'Model classified the machine in FAULT state with high confidence based on combined multi-sensor feature attributions.',
      }
    }

    return {
      type: 'OPERATIONAL DEGRADATION',
      severity: 'MEDIUM',
      description:
        'Telemetry trending outside baseline operating envelopes. Preventative inspection advised.',
    }
  }

  const getMaintenanceAction = (feature) => {
    const actions = {
      vibration:
        'Inspect drive bearings, measure shaft runout, check coupling alignment, and tighten motor foundation bolts.',
      motor_temperature:
        'Verify stator cooling fins are clean, inspect lubrication quality, and ensure external ambient ventilation is unimpeded.',
      pressure:
        'Inspect fluid seals, pressure relief valves, check for inlet restrictions, and calibrate pressure sensors.',
      rpm:
        'Check drive controller tuning, examine pulley/gear engagement, and verify sensor tachometer alignment.',
      motor_voltage:
        'Audit three-phase supply balance, verify supply voltage regulation, and inspect main terminal lugs.',
      motor_current:
        'Inspect for mechanical binding, verify phase currents are balanced, and check for stator turn shorts.',
      ambient_temperature:
        'Ensure enclosure ventilation fans are functional and operating environment does not exceed 40°C.',
      humidity:
        'Check enclosure IP sealing gaskets and verify desiccant condition inside high-voltage electrical compartments.',
    }
    return (
      actions[feature] ||
      'Inspect sensor assembly, verify calibration standard, and assess mechanical linkages.'
    )
  }

  // =========================================================
  // RENDER: LOADING SCREEN
  // =========================================================
  if (loading && !dashboard) {
    return (
      <div className="loading-screen">
        <div className="loading-core">
          <Cpu size={36} />
        </div>
        <div className="loading-text-group">
          <h2>INITIALIZING AI CONTROL CENTER</h2>
          <p>Connecting to machine telemetry stream and ML inference services...</p>
        </div>
      </div>
    )
  }

  // =========================================================
  // RENDER: DASHBOARD
  // =========================================================
  const renderDashboard = () => {
    const diagnosis = getFaultDiagnosis(latestPrediction)
    const features = currentFeatures

    return (
      <div className="page-content">
        <div className="page-heading">
          <p className="section-label">SYSTEM TELEMETRY & HEALTH INTELLIGENCE</p>
          <h2>Industrial Monitoring Dashboard</h2>
          <p className="page-description">
            Continuous machine health assessment, ML-powered fault classification, and Explainable AI
            diagnostics.
          </p>
        </div>

        {/* 1-CLICK QUICK FAULT SCENARIOS RIBBON */}
        <section className="quick-scenarios-bar panel">
          <div className="quick-scenarios-header">
            <div className="quick-title-box">
              <Zap size={18} className="zap-icon" />
              <strong>Quick Fault Injection & Simulation:</strong>
              <span>Test live machine state transitions in 1 click:</span>
            </div>
            <button
              className="btn-open-studio"
              onClick={() => setActivePage('simulation')}
            >
              <Sliders size={14} />
              <span>Open Simulation Studio</span>
            </button>
          </div>

          <div className="quick-buttons-row">
            {SCENARIOS.map((s) => (
              <button
                key={s.id}
                className={`quick-scenario-btn s-${s.badge.toLowerCase()}`}
                onClick={() => executeQuickScenario(s)}
                title={s.description}
              >
                <span className="btn-badge">{s.badge}</span>
                <span className="btn-name">{s.name.split('.')[1] || s.name}</span>
              </button>
            ))}
          </div>
        </section>

        {/* TOP STATS & GAUGE GRID */}
        <section className="stats-gauge-composite">
          <div className="gauge-card panel">
            <HealthGauge score={healthScore} health={health} size={180} />
            <div className="gauge-sub-meta">
              <span>Overall Machine Integrity</span>
              <button
                className="gauge-action-link"
                onClick={() => setActivePage('prognostics')}
              >
                <Gauge size={14} />
                <span>View Prognostics & RUL</span>
              </button>
            </div>
          </div>

          <div className="stats-grid-compact">
            <div className={`stat-card state-${predictionState.toLowerCase()}`}>
              <div className="stat-icon purple">
                <BrainCircuit size={26} />
              </div>
              <div className="stat-content">
                <span className="stat-label">AI PREDICTION</span>
                <strong className="stat-value">{predictionState}</strong>
                <span className="stat-sub">{confidence}% Confidence</span>
              </div>
            </div>

            <div className={`stat-card health-${health.toLowerCase()}`}>
              <div className="stat-icon red">
                <ShieldAlert size={26} />
              </div>
              <div className="stat-content">
                <span className="stat-label">CONDITION</span>
                <strong className="stat-value">{health}</strong>
                <span className="stat-sub">Score: {healthScore}/100</span>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon orange">
                <TriangleAlert size={26} />
              </div>
              <div className="stat-content">
                <span className="stat-label">OPEN ANOMALIES</span>
                <strong className="stat-value">{openAnomalies}</strong>
                <span className="stat-sub">
                  Score: {latestAnomaly?.anomaly_score ? Number(latestAnomaly.anomaly_score).toFixed(3) : '0.000'}
                </span>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon blue">
                <BellRing size={26} />
              </div>
              <div className="stat-content">
                <span className="stat-label">ACTIVE ALERTS</span>
                <strong className="stat-value">{activeAlerts}</strong>
                <span className="stat-sub">
                  {activeAlerts > 0 ? 'Requires attention' : 'All systems clear'}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* REAL-TIME DYNAMIC TELEMETRY CHARTS */}
        <section className="dashboard-charts-row">
          <TelemetryCharts history={telemetryHistory} />
        </section>

        {/* MAIN DASHBOARD MATRIX */}
        <section className="dashboard-grid">
          {/* LATEST PREDICTION PANEL */}
          <div className="panel prediction-panel">
            <div className="panel-header">
              <div>
                <p className="section-label">INFERENCE ENGINE</p>
                <h2>Machine Fault Prediction</h2>
              </div>
              <div className={`decision-badge state-${predictionState.toLowerCase()}`}>
                {predictionState}
              </div>
            </div>

            <div className="prediction-display">
              <div className="metric-box">
                <span className="metric-label">CLASSIFICATION</span>
                <strong className={`metric-value val-${predictionState.toLowerCase()}`}>
                  {predictionState}
                </strong>
              </div>
              <div className="metric-box">
                <span className="metric-label">MODEL CONFIDENCE</span>
                <strong className="metric-value">{confidence}%</strong>
              </div>
            </div>

            <div className="confidence-bar">
              <div
                className={`bar-fill bar-${predictionState.toLowerCase()}`}
                style={{ width: `${Math.min(Number(confidence), 100)}%` }}
              />
            </div>

            <div className="panel-footer-meta">
              <span>Model: XGBoost Multi-Class</span>
              <span>{latestPrediction?.created_at ? formatDate(latestPrediction.created_at) : 'Live Stream'}</span>
            </div>
          </div>

          {/* ANOMALY DETECTION PANEL */}
          <div className="panel anomaly-panel">
            <div className="panel-header">
              <div>
                <p className="section-label">OUTLIER ANALYSIS</p>
                <h2>Anomaly Detection</h2>
              </div>
              <AlertTriangle size={24} className="panel-icon-accent" />
            </div>

            <div className="anomaly-summary">
              <div className="anomaly-header">
                <span className={`anomaly-badge ${latestAnomaly?.status === 'OPEN' ? 'badge-open' : 'badge-ok'}`}>
                  {latestAnomaly?.status || 'NORMAL'}
                </span>
                <span className="anomaly-score-tag">
                  Score: {latestAnomaly?.anomaly_score !== undefined ? Number(latestAnomaly.anomaly_score).toFixed(4) : '0.0000'}
                </span>
              </div>
              <p className="anomaly-desc">
                {latestAnomaly?.status === 'OPEN'
                  ? 'Unusual multi-sensor pattern detected deviating from standard nominal baseline.'
                  : 'Sensor observations match expected operational distributions.'}
              </p>
            </div>

            <div className="panel-footer-meta">
              <span>Detector: Isolation Forest</span>
              <span>Status: {openAnomalies} Open Events</span>
            </div>
          </div>

          {/* AI DIAGNOSIS & PRESCRIPTIVE ACTION */}
          <div className="panel insight-preview">
            <div className="panel-header">
              <div>
                <p className="section-label">AI EXPLANATION & DIAGNOSIS</p>
                <h2>Intelligent Diagnosis</h2>
              </div>
              <Brain size={24} className="panel-icon-accent" />
            </div>

            <div className="diagnosis-preview-box">
              <span className={`diagnosis-tag severity-${diagnosis.severity.toLowerCase()}`}>
                {diagnosis.severity} SEVERITY
              </span>
              <strong className="fault-preview">{diagnosis.type}</strong>
              <p className="insight-text">{diagnosis.description}</p>
            </div>

            <div className="diagnosis-btn-row">
              <button className="panel-action-btn primary" onClick={() => setActivePage('ai')}>
                <BrainCircuit size={15} />
                <span>VIEW SHAP XAI</span>
              </button>
              <button className="panel-action-btn secondary" onClick={() => setActivePage('workorders')}>
                <Wrench size={15} />
                <span>WORK ORDER</span>
              </button>
            </div>
          </div>

          {/* LIVE SENSOR METRICS PREVIEW */}
          <div className="panel telemetry-preview-panel">
            <div className="panel-header">
              <div>
                <p className="section-label">PRIMARY TELEMETRY</p>
                <h2>Live Sensor Readings</h2>
              </div>
              <Activity size={24} className="panel-icon-accent" />
            </div>

            <div className="mini-telemetry-grid">
              <div className="mini-telemetry-card">
                <span>VIBRATION</span>
                <strong>{features.vibration !== undefined ? `${features.vibration} mm/s` : '0.80 mm/s'}</strong>
              </div>
              <div className="mini-telemetry-card">
                <span>MOTOR TEMP</span>
                <strong>{features.motor_temperature !== undefined ? `${features.motor_temperature} °C` : '68 °C'}</strong>
              </div>
              <div className="mini-telemetry-card">
                <span>ROTATION (RPM)</span>
                <strong>{features.rpm !== undefined ? `${features.rpm} RPM` : '1360 RPM'}</strong>
              </div>
              <div className="mini-telemetry-card">
                <span>PRESSURE</span>
                <strong>{features.pressure !== undefined ? `${features.pressure} Bar` : '4.7 Bar'}</strong>
              </div>
            </div>

            <button className="panel-action-btn" onClick={() => setActivePage('twin')}>
              <Box size={16} />
              <span>OPEN DIGITAL TWIN</span>
            </button>
          </div>
        </section>
      </div>
    )
  }

  // =========================================================
  // RENDER: DIGITAL TWIN (HAN'S LASER FIBER MARKING SYSTEM)
  // =========================================================
  const renderTwin = () => {
    return (
      <LaserDigitalTwin
        machineName="Han's Laser Fiber Marking Station"
        predictionState={predictionState}
        healthScore={healthScore}
        telemetry={currentFeatures}
        onSelectScenario={executeQuickScenario}
        onOpenWorkOrder={() => setActivePage('workorders')}
        isStreaming={isStreaming}
        onToggleStreaming={toggleGlobalStreaming}
        streamCount={streamCount}
      />
    )
  }

  // =========================================================
  // RENDER: EXPLAINABLE AI (XAI)
  // =========================================================
  const renderAI = () => {
    const explanation = latestPrediction?.explanation || {}
    const xai = explanation?.xai || {}
    const topContributors = Array.isArray(xai?.top_contributors) ? xai.top_contributors : []
    const featureContributions = xai?.feature_contributions || {}
    const classProbabilities = explanation?.class_probabilities || {}

    const features = Object.entries(featureContributions).sort(
      ([, a], [, b]) => Math.abs(Number(b)) - Math.abs(Number(a))
    )

    const maxContribution = Math.max(
      ...features.map(([, val]) => Math.abs(Number(val))),
      1
    )

    const maxTopContribution = Math.max(
      ...topContributors.map((item) => Math.abs(Number(item.shap_value))),
      1
    )

    const diagnosisContributors = topContributors.filter(
      (item) => item.direction === 'increases_fault_prediction'
    )

    const primaryContributor = diagnosisContributors[0] || topContributors[0] || null
    const faultDiagnosis = getFaultDiagnosis(latestPrediction)

    return (
      <div className="page-content xai-page">
        <div className="page-heading">
          <p className="section-label">TRANSPARENT ARTIFICIAL INTELLIGENCE</p>
          <h2>Explainable AI (SHAP) Analysis</h2>
          <p className="page-description">
            Deconstructing the XGBoost decision pipeline using Shapley Additive Explanations (SHAP)
            TreeExplainer.
          </p>
        </div>

        {/* TOP DECISION SUMMARY */}
        <section className="xai-summary">
          <div className={`xai-state state-${predictionState.toLowerCase()}`}>
            <span className="xai-state-label">MODEL DECISION</span>
            <strong className="xai-state-val">{predictionState}</strong>
            <p className="xai-state-conf">{confidence}% Confidence</p>
          </div>

          <div className="xai-description">
            <div className="xai-desc-header">
              <BrainCircuit size={28} />
              <h3>How does SHAP explain this prediction?</h3>
            </div>
            <p>
              The SHAP framework computes the marginal contribution of each physical sensor parameter
              to the model’s classification score. Parameters with positive attributions pushed the model
              toward predicting <strong>{predictionState}</strong>, while negative values offset the risk.
            </p>
            <div className="model-environment-badge">
              <Info size={14} />
              <span>
                Simulated Training Benchmark: Model trained on synthetic industrial telemetry dynamics.
              </span>
            </div>
          </div>
        </section>

        {/* INTELLIGENT DIAGNOSIS CARD */}
        <section className="xai-panel ai-diagnosis-panel">
          <div className="panel-header">
            <div>
              <p className="section-label">ENGINEERING INTERPRETATION</p>
              <h2>Probable Machine Fault Type</h2>
            </div>
            <AlertTriangle size={24} className="panel-icon-accent" />
          </div>

          <div className="diagnosis-content">
            <div className="diagnosis-status">
              <span className="diagnosis-label">DIAGNOSIS CLASSIFICATION</span>
              <strong className="diagnosis-title">{faultDiagnosis.type}</strong>
            </div>

            <div className="diagnosis-status">
              <span className="diagnosis-label">SEVERITY LEVEL</span>
              <strong className={`diagnosis-severity severity-${faultDiagnosis.severity.toLowerCase()}`}>
                {faultDiagnosis.severity}
              </strong>
            </div>

            <p className="diagnosis-text">{faultDiagnosis.description}</p>
          </div>
        </section>

        {/* TOP SHAP CONTRIBUTORS */}
        <section className="xai-panel">
          <div className="panel-header">
            <div>
              <p className="section-label">FEATURE IMPORTANCE</p>
              <h2>Primary SHAP Contributors for {predictionState}</h2>
            </div>
            <Brain size={24} className="panel-icon-accent" />
          </div>

          <div className="contributors-list">
            {topContributors.length > 0 ? (
              topContributors.map((contributor, index) => {
                const increasesFault = contributor.direction === 'increases_fault_prediction'
                const impact = Math.abs(Number(contributor.shap_value))
                const width = Math.min((impact / maxTopContribution) * 100, 100)

                return (
                  <div
                    className={`contributor-row ${increasesFault ? 'row-danger' : 'row-safe'}`}
                    key={contributor.feature}
                  >
                    <div className="contributor-rank">#{index + 1}</div>

                    <div className="contributor-info">
                      <div className="contributor-title">
                        <strong>{formatFeatureName(contributor.feature)}</strong>
                        <span className={increasesFault ? 'impact-danger' : 'impact-safe'}>
                          {increasesFault ? '▲ INCREASES FAULT RISK' : '▼ REDUCES FAULT RISK'}
                        </span>
                      </div>

                      <div className="contributor-bar">
                        <div
                          className={`bar-fill ${increasesFault ? 'bar-danger' : 'bar-safe'}`}
                          style={{ width: `${width}%` }}
                        />
                      </div>
                    </div>

                    <strong className={`shap-value ${increasesFault ? 'val-danger' : 'val-safe'}`}>
                      {increasesFault ? `+${impact.toFixed(4)}` : `-${impact.toFixed(4)}`}
                    </strong>
                  </div>
                )
              })
            ) : (
              <div className="empty-card">
                <Info size={28} />
                <p>No SHAP explanation data available for this prediction.</p>
              </div>
            )}
          </div>
        </section>

        {/* COMPLETE SENSOR CONTRIBUTION MAP */}
        <section className="xai-panel">
          <div className="panel-header">
            <div>
              <p className="section-label">GLOBAL FEATURE MAP</p>
              <h2>Complete Sensor Contribution Spectrum</h2>
            </div>
            <Gauge size={24} className="panel-icon-accent" />
          </div>

          <div className="feature-grid">
            {features.length > 0 ? (
              features.map(([feature, value]) => {
                const numeric = Number(value) || 0
                const isPositive = numeric > 0
                const isNegative = numeric < 0
                const width = Math.min((Math.abs(numeric) / maxContribution) * 100, 100)

                return (
                  <div
                    className={`feature-card ${isPositive ? 'feature-danger' : isNegative ? 'feature-safe' : 'feature-neutral'}`}
                    key={feature}
                  >
                    <div className="feature-card-top">
                      <span className="feature-name">{formatFeatureName(feature)}</span>
                      <strong className={`feature-val ${isPositive ? 'val-danger' : isNegative ? 'val-safe' : ''}`}>
                        {numeric > 0 ? `+${numeric.toFixed(4)}` : numeric.toFixed(4)}
                      </strong>
                    </div>

                    <div className="feature-bar">
                      <div
                        className={`bar-fill ${isPositive ? 'bar-danger' : isNegative ? 'bar-safe' : 'bar-neutral'}`}
                        style={{ width: `${width}%` }}
                      />
                    </div>

                    <small className={`feature-note ${isPositive ? 'note-danger' : isNegative ? 'note-safe' : ''}`}>
                      {isPositive
                        ? '▲ Pushing prediction toward machine fault'
                        : isNegative
                        ? '▼ Dampening model fault probability'
                        : '● Neutral impact on prediction'}
                    </small>
                  </div>
                )
              })
            ) : (
              <div className="empty-card">
                <Info size={28} />
                <p>No feature contributions found.</p>
              </div>
            )}
          </div>
        </section>

        {/* PREDICTION PROBABILITY DISTRIBUTION */}
        <section className="xai-panel">
          <div className="panel-header">
            <div>
              <p className="section-label">PROBABILITY DENSITY</p>
              <h2>Multi-Class Machine State Probabilities</h2>
            </div>
            <Activity size={24} className="panel-icon-accent" />
          </div>

          <div className="probability-grid">
            {Object.entries(classProbabilities).length > 0 ? (
              Object.entries(classProbabilities)
                .sort(([, a], [, b]) => Number(b) - Number(a))
                .map(([state, value]) => {
                  const percentage = Number(value) * 100
                  return (
                    <div className={`probability-card state-${state.toLowerCase()}`} key={state}>
                      <span className="probability-state">{state}</span>
                      <strong className="probability-val">{percentage.toFixed(2)}%</strong>
                      <div className="probability-bar">
                        <div
                          className={`bar-fill bar-${state.toLowerCase()}`}
                          style={{ width: `${Math.min(percentage, 100)}%` }}
                        />
                      </div>
                    </div>
                  )
                })
            ) : (
              <div className="empty-card">
                <Info size={28} />
                <p>No class probability distribution available.</p>
              </div>
            )}
          </div>
        </section>
      </div>
    )
  }

  // =========================================================
  // RENDER: ALERTS PAGE
  // =========================================================
  const renderAlerts = () => (
    <div className="page-content">
      <div className="page-heading">
        <p className="section-label">INCIDENT & SAFETY DISPATCH</p>
        <h2>System Alert Center</h2>
        <p className="page-description">
          Real-time threshold violations and automated machine fault alerts. Technicians can review
          and resolve incidents.
        </p>
      </div>

      <div className="data-list">
        {alerts.map((alert) => {
          const isResolved = Boolean(alert.resolved || alert.resolved_at)
          const severity = (alert.severity || 'WARNING').toUpperCase()

          return (
            <div
              className={`data-row alert-row ${isResolved ? 'resolved' : 'active'}`}
              key={alert.id}
            >
              <div className={`data-icon ${severity === 'CRITICAL' ? 'red' : 'orange'}`}>
                <AlertTriangle size={24} />
              </div>

              <div className="data-main">
                <div className="data-header-row">
                  <strong className="data-title">
                    {alert.condition_description || alert.message || 'Machine Alert Condition'}
                  </strong>
                  <span className={`status-badge ${isResolved ? 'badge-resolved' : 'badge-active'}`}>
                    {isResolved ? 'RESOLVED' : 'ACTIVE'}
                  </span>
                  <span className={`severity-badge severity-${severity.toLowerCase()}`}>
                    {severity}
                  </span>
                </div>

                {alert.suggested_action && (
                  <p className="alert-action-text">
                    <strong>Suggested Action:</strong> {alert.suggested_action}
                  </p>
                )}

                <div className="data-meta-row">
                  <span>Parameter: {alert.parameter_key || 'General'}</span>
                  {alert.value !== null && alert.value !== undefined && (
                    <span>Measured: {Number(alert.value).toFixed(2)}</span>
                  )}
                  {alert.threshold !== null && alert.threshold !== undefined && (
                    <span>Threshold: {Number(alert.threshold).toFixed(2)}</span>
                  )}
                  <span>Triggered: {formatDate(alert.triggered_at)}</span>
                  {isResolved && alert.resolved_at && (
                    <span>Resolved: {formatDate(alert.resolved_at)}</span>
                  )}
                </div>
              </div>

              {!isResolved && (
                <button
                  className="resolve-btn"
                  onClick={() => resolveAlert(alert.id)}
                  title="Resolve this alert"
                >
                  <Wrench size={16} />
                  <span>Resolve Alert</span>
                </button>
              )}
            </div>
          )
        })}

        {alerts.length === 0 && (
          <div className="empty-card">
            <ShieldCheck size={32} />
            <p>All operating alerts are cleared. Machine is safe.</p>
          </div>
        )}
      </div>
    </div>
  )

  // =========================================================
  // RENDER: PREDICTIONS PAGE
  // =========================================================
  const renderPredictions = () => (
    <div className="page-content">
      <div className="page-heading">
        <p className="section-label">INFERENCE AUDIT TRAIL</p>
        <h2>AI Prediction History</h2>
        <p className="page-description">
          Historical log of machine state classifications generated by the XGBoost predictive model.
        </p>
      </div>

      <div className="data-list">
        {predictions.map((prediction) => {
          const state = prediction.predicted_state || prediction.predicted_fault || 'NORMAL'
          const diagnosis = getFaultDiagnosis(prediction)
          const prob =
            prediction.probability !== undefined && prediction.probability !== null
              ? (Number(prediction.probability) * 100).toFixed(2)
              : '0.00'

          return (
            <div className="data-row prediction-row" key={prediction.id}>
              <div className={`data-icon ${state === 'FAULT' ? 'red' : state === 'DEGRADING' ? 'orange' : 'green'}`}>
                <BrainCircuit size={24} />
              </div>

              <div className="data-main">
                <div className="data-header-row">
                  <strong className="data-title">{diagnosis.type}</strong>
                  <span className={`state-badge state-${state.toLowerCase()}`}>{state}</span>
                  <span className="confidence-pill">{prob}% Confidence</span>
                </div>

                <p className="prediction-desc">{diagnosis.description}</p>

                <div className="data-meta-row">
                  <span>Inference ID: {prediction.id.slice(0, 8)}...</span>
                  <span>Source: {prediction.explanation?.data_source || 'SIMULATED_MODEL'}</span>
                  <span>{formatDate(prediction.created_at)}</span>
                </div>
              </div>
            </div>
          )
        })}

        {predictions.length === 0 && (
          <div className="empty-card">
            <Info size={32} />
            <p>No prediction history records available for this machine.</p>
          </div>
        )}
      </div>
    </div>
  )

  // =========================================================
  // RENDER: MACHINES PAGE
  // =========================================================
  const renderMachines = () => (
    <div className="page-content">
      <div className="page-heading">
        <p className="section-label">FLEET ASSET REGISTRY</p>
        <h2>Machine Control Center</h2>
        <p className="page-description">
          Select an industrial machine to inspect telemetry streams, AI predictions, active alerts,
          and Digital Twin models.
        </p>
      </div>

      <div className="machine-list">
        {machines.map((machine) => {
          const isSelected = machine.id === machineId
          return (
            <div
              key={machine.id}
              className={`machine-row ${isSelected ? 'selected' : ''}`}
              onClick={() => selectMachine(machine.id)}
            >
              <div className="machine-row-icon">
                <Cpu size={26} />
              </div>

              <div className="machine-info-main">
                <div className="machine-title-row">
                  <strong>{machine.machine_name || machine.name || 'Industrial Test Motor'}</strong>
                  <span className="machine-code-badge">{machine.machine_code || 'CODE-001'}</span>
                  {isSelected && <span className="active-tag">CURRENT ASSET</span>}
                </div>
                <div className="machine-meta-row">
                  <span>Type: {machine.machine_type || 'TEST ROTATING RIG'}</span>
                  <span>ID: {machine.id}</span>
                  <span>Operating Hours: {machine.operating_hours || 0} hrs</span>
                </div>
              </div>

              <div className="machine-action">
                <ChevronRight size={22} />
              </div>
            </div>
          )
        })}

        {machines.length === 0 && (
          <div className="empty-card">
            <Info size={32} />
            <p>No machines registered in the database.</p>
          </div>
        )}
      </div>
    </div>
  )

  // =========================================================
  // PAGE DISPATCHER
  // =========================================================
  const renderPage = () => {
    switch (activePage) {
      case 'simulation':
        return (
          <div className="page-content">
            <div className="page-heading">
              <p className="section-label">FAULT INJECTION & TESTING SUITE</p>
              <h2>Live Simulation & Telemetry Studio</h2>
              <p className="page-description">
                Inject realistic industrial failure modes, trigger real-time ML state transitions, and
                simulate continuous IoT sensor streams.
              </p>
            </div>
            <SimulationStudio
              machineId={machineId}
              apiUrl={API_URL}
              currentParameters={currentFeatures}
              isStreaming={isStreaming}
              onToggleStreaming={toggleGlobalStreaming}
              streamCount={streamCount}
              streamIntervalMs={streamIntervalMs}
              onIntervalChange={setStreamIntervalMs}
              onExecuteInference={executeSimulationStep}
            />
          </div>
        )
      case 'prognostics':
        return (
          <div className="page-content">
            <div className="page-heading">
              <p className="section-label">ASSET RELIABILITY & DEGRADATION</p>
              <h2>Remaining Useful Life & Prognostics</h2>
              <p className="page-description">
                Prognostics modeling tracking degradation progress along the industrial P-F curve to
                prevent catastrophic equipment breakdown.
              </p>
            </div>
            <PrognosticsRUL
              predictionState={predictionState}
              healthScore={healthScore}
              telemetry={currentFeatures}
              operatingHours={1240}
            />
          </div>
        )
      case 'workorders':
        return (
          <WorkOrders
            machineId={machineId}
            machineName={machineName}
            predictionState={predictionState}
            alerts={alerts}
            prediction={latestPrediction}
          />
        )
      case 'defense':
        return <VivaDefenseGuide />
      case 'machines':
        return renderMachines()
      case 'predictions':
        return renderPredictions()
      case 'alerts':
        return renderAlerts()
      case 'ai':
        return renderAI()
      case 'twin':
        return renderTwin()
      default:
        return renderDashboard()
    }
  }

  const navigation = [
    { id: 'dashboard', label: 'Dashboard', icon: Activity },
    { id: 'simulation', label: 'Simulation Studio', icon: Zap },
    { id: 'twin', label: 'Digital Twin', icon: Box },
    { id: 'prognostics', label: 'RUL & Prognostics', icon: Gauge },
    { id: 'workorders', label: 'Work Orders', icon: Wrench },
    { id: 'ai', label: 'Explainable AI', icon: Brain },
    { id: 'alerts', label: 'Alerts', icon: AlertTriangle, badge: activeAlerts },
    { id: 'predictions', label: 'Predictions', icon: BrainCircuit },
    { id: 'machines', label: 'Machines', icon: Cpu },
    { id: 'defense', label: 'Viva & Defense', icon: Award },
  ]

  // =========================================================
  // SHELL LAYOUT
  // =========================================================
  return (
    <div className="app-shell">
      {/* SIDEBAR */}
      <aside className={`sidebar ${sidebarOpen ? 'expanded' : 'collapsed'}`}>
        <div className="sidebar-brand">
          <div className="brand-icon">
            <Cpu size={28} />
          </div>

          {sidebarOpen && (
            <div className="brand-text">
              <strong>PREDICTIVE</strong>
              <span>MAINTENANCE AI</span>
            </div>
          )}

          <button
            className="sidebar-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            {sidebarOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
          </button>
        </div>

        <nav className="sidebar-nav">
          {navigation.map(({ id, label, icon: Icon, badge }) => (
            <button
              key={id}
              className={`nav-item ${activePage === id ? 'active' : ''}`}
              onClick={() => setActivePage(id)}
              title={label}
            >
              <Icon size={22} className="nav-icon" />
              {sidebarOpen && <span className="nav-label">{label}</span>}
              {badge !== undefined && badge > 0 && (
                <span className={`nav-badge ${sidebarOpen ? '' : 'badge-dot'}`}>
                  {sidebarOpen ? badge : ''}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-status">
          <Wifi size={16} className="status-dot-icon" />
          {sidebarOpen && <span>Telemetry Online</span>}
        </div>
      </aside>

      {/* MAIN VIEWPORT */}
      <main className="main-content">
        <header className="topbar">
          <div className="topbar-title-group">
            <p className="breadcrumb">CONTROL CENTER / {activePage.toUpperCase()}</p>
            <h1>
              {activePage === 'dashboard'
                ? 'Machine Health Dashboard'
                : activePage === 'simulation'
                ? 'Fault Injection & Simulation Studio'
                : activePage === 'prognostics'
                ? 'Remaining Useful Life (RUL) & Prognostics'
                : activePage === 'workorders'
                ? 'Prescriptive Maintenance Work Orders'
                : activePage === 'defense'
                ? 'Architecture & Viva Defense Guide'
                : activePage === 'machines'
                ? 'Machine Control Center'
                : activePage === 'predictions'
                ? 'AI Prediction History'
                : activePage === 'alerts'
                ? 'System Alert Center'
                : activePage === 'ai'
                ? 'Explainable AI Intelligence'
                : 'Digital Twin Monitoring'}
            </h1>
          </div>

          <div className="topbar-actions">
            <button
              className={`stream-pill-button ${isStreaming ? 'streaming-live' : ''}`}
              onClick={toggleGlobalStreaming}
              title={isStreaming ? 'Pause continuous simulation stream' : 'Start live background simulation stream'}
            >
              <span className={`stream-pill-dot ${isStreaming ? 'pulsing' : ''}`} />
              <span className="stream-pill-label">
                {isStreaming ? `SIM STREAMING (#${streamCount})` : 'SIM STREAM IDLE'}
              </span>
              {isStreaming ? <Pause size={14} /> : <Play size={14} />}
            </button>

            <div className="current-machine-indicator">
              <span className="indicator-dot" />
              <span>{machineName}</span>
            </div>

            <button
              className={`refresh-button ${refreshing ? 'refreshing' : ''}`}
              onClick={refreshEverything}
              disabled={refreshing}
            >
              <RefreshCw size={18} className={refreshing ? 'spin-icon' : ''} />
              <span>{refreshing ? 'REFRESHING...' : 'REFRESH DATA'}</span>
            </button>
          </div>
        </header>

        {error && (
          <div className="error-banner">
            <AlertTriangle size={18} />
            <span>{error}</span>
          </div>
        )}

        {actionSuccess && (
          <div className="success-banner">
            <CheckCircle2 size={18} />
            <span>{actionSuccess}</span>
          </div>
        )}

        {renderPage()}

        <footer className="app-footer">
          <div className="footer-content">
            <span className="footer-tag">
              <i className="status-live-pulse" />
              PREDICTIVE MAINTENANCE PLATFORM • MAJOR PROJECT EDITION (120 MARKS)
            </span>
            <span className="footer-machine">ACTIVE ASSET ID: {machineId}</span>
          </div>
        </footer>
      </main>
    </div>
  )
}

export default App