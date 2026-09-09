import { useState, useEffect, useRef } from 'react'
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Pause,
  Play,
  RotateCw,
  Sliders,
  Zap,
} from 'lucide-react'
import {
  SCENARIOS,
  NOMINAL_BASELINE,
  SLIDER_DEFINITIONS,
  sanitizeTelemetry,
  generateStreamJitter,
} from '../data/scenarios'

export function SimulationStudio({
  machineId,
  apiUrl,
  onTelemetrySent,
  currentParameters,
  // Optional lifted props from App.jsx
  isStreaming: globalIsStreaming,
  onToggleStreaming: globalToggleStreaming,
  streamCount: globalStreamCount,
  streamIntervalMs: globalIntervalMs,
  onExecuteInference: globalExecuteInference,
  onResetMachine,
}) {
  const [selectedScenario, setSelectedScenario] = useState('nominal')
  const [customParams, setCustomParams] = useState(() =>
    sanitizeTelemetry(currentParameters || NOMINAL_BASELINE)
  )
  const [prevParamsProp, setPrevParamsProp] = useState(currentParameters)
  const [activeTab, setActiveTab] = useState('scenarios') // 'scenarios' | 'sliders'
  const [localIsStreaming, setLocalIsStreaming] = useState(false)
  const [localStreamCount, setLocalStreamCount] = useState(0)
  const [injecting, setInjecting] = useState(false)
  const [lastResult, setLastResult] = useState(null)
  const [statusMessage, setStatusMessage] = useState(null)

  const streamRef = useRef(null)
  const customParamsRef = useRef(customParams)

  useEffect(() => {
    customParamsRef.current = customParams
  }, [customParams])

  // Resolve whether we are controlled globally or locally
  const isStreaming = globalIsStreaming !== undefined ? globalIsStreaming : localIsStreaming
  const streamCount = globalStreamCount !== undefined ? globalStreamCount : localStreamCount
  const streamIntervalMs = globalIntervalMs !== undefined ? globalIntervalMs : 2000

  // Adjust state when currentParameters changes externally (official React pattern)
  if (currentParameters && currentParameters !== prevParamsProp) {
    setPrevParamsProp(currentParameters)
    setCustomParams((prev) => ({
      ...prev,
      ...sanitizeTelemetry(currentParameters),
    }))
  }

  // Clean up local streaming on unmount if used locally
  useEffect(() => {
    return () => {
      if (streamRef.current) clearInterval(streamRef.current)
    }
  }, [])

  const executeInference = async (telemetryData, sourceLabel = 'MANUAL') => {
    const payload = sanitizeTelemetry(telemetryData)
    try {
      setInjecting(true)
      setStatusMessage(null)
      const t0 = performance.now()

      let data
      if (globalExecuteInference) {
        data = await globalExecuteInference(payload, sourceLabel)
      } else {
        const response = await fetch(`${apiUrl}/machines/${machineId}/predict`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })

        if (!response.ok) {
          throw new Error(`Inference engine rejected payload (${response.status})`)
        }
        data = await response.json()
      }

      const elapsed = Math.round(performance.now() - t0)

      setLastResult({
        state: data.predicted_fault || 'UNKNOWN',
        probability: Number(data.probability) || 0,
        anomalyScore: data.explanation?.anomaly_detection?.anomaly_score ?? 0,
        isAnomaly: data.explanation?.anomaly_detection?.is_anomaly ?? false,
        latencyMs: elapsed,
        timestamp: new Date().toLocaleTimeString(),
        source: sourceLabel,
      })

      setStatusMessage({
        type: 'success',
        text: `Injected telemetry! Classified as ${data.predicted_fault} (${(
          (Number(data.probability) || 0) * 100
        ).toFixed(1)}% confidence) in ${elapsed}ms.`,
      })

      if (onTelemetrySent) {
        onTelemetrySent(payload, data)
      }
      return data
    } catch (err) {
      console.error('Simulation injection error:', err)
      setStatusMessage({
        type: 'error',
        text: err.message || 'Failed to communicate with prediction service.',
      })
      throw err
    } finally {
      setInjecting(false)
    }
  }

  // Inject a specific scenario
  const handleInjectScenario = (scenario) => {
    setSelectedScenario(scenario.id)
    const sanitized = sanitizeTelemetry(scenario.values)
    setCustomParams(sanitized)
    executeInference(sanitized, scenario.name).catch(() => {})
  }

  // Handle slider changes
  const handleSliderChange = (paramKey, value) => {
    setCustomParams((prev) => ({
      ...prev,
      [paramKey]: Number(value),
    }))
  }

  // Local streaming tick (when not globally lifted)
  const sendLocalStreamTick = async () => {
    const nextParams = generateStreamJitter(customParamsRef.current)
    setCustomParams(nextParams)
    setLocalStreamCount((c) => c + 1)
    await executeInference(nextParams, 'LIVE STREAM').catch(() => {})
  }

  // Toggle streaming (delegates to global handler if available)
  const toggleStreaming = () => {
    if (globalToggleStreaming) {
      globalToggleStreaming()
      return
    }

    if (localIsStreaming) {
      if (streamRef.current) clearInterval(streamRef.current)
      streamRef.current = null
      setLocalIsStreaming(false)
      setStatusMessage({ type: 'info', text: 'Live telemetry stream paused.' })
    } else {
      setLocalIsStreaming(true)
      setStatusMessage({
        type: 'info',
        text: `Streaming telemetry active (every ${streamIntervalMs / 1000}s)...`,
      })

      sendLocalStreamTick()
      streamRef.current = setInterval(() => {
        sendLocalStreamTick()
      }, streamIntervalMs)
    }
  }

  const handleResetToBaseline = () => {
    const nominal = SCENARIOS[0]
    handleInjectScenario(nominal)
  }

  const handleMachineReset = async () => {
    if (isStreaming && globalToggleStreaming) {
      globalToggleStreaming()
    }
    setSelectedScenario('nominal')
    setCustomParams(sanitizeTelemetry(NOMINAL_BASELINE))
    setLastResult(null)
    setStatusMessage({ type: 'info', text: 'Resetting machine to nominal operating state...' })

    try {
      if (onResetMachine) {
        await onResetMachine()
      } else {
        await executeInference(NOMINAL_BASELINE, 'MACHINE RESET')
      }
    } catch {
      // The inference handler presents the failure message to the operator.
    }
  }

  return (
    <div className="simulation-studio-panel panel">
      <div className="panel-header">
        <div>
          <p className="section-label">INTERACTIVE TESTING & DEMO ENVIRONMENT</p>
          <h2>Fault Injection & Telemetry Studio</h2>
        </div>
        <div className="simulation-mode-tabs">
          <button
            className={`sim-tab ${activeTab === 'scenarios' ? 'active' : ''}`}
            onClick={() => setActiveTab('scenarios')}
          >
            <Zap size={15} />
            <span>PRESET SCENARIOS</span>
          </button>
          <button
            className={`sim-tab ${activeTab === 'sliders' ? 'active' : ''}`}
            onClick={() => setActiveTab('sliders')}
          >
            <Sliders size={15} />
            <span>CUSTOM SLIDERS</span>
          </button>
        </div>
      </div>

      {/* Streaming Controller Bar */}
      <div className="stream-controller-bar">
        <div className="stream-status-group">
          <span className={`live-stream-badge ${isStreaming ? 'streaming-active' : ''}`}>
            <span className="stream-dot" />
            {isStreaming ? `LIVE STREAMING (#${streamCount})` : 'STREAM IDLE'}
          </span>
          <span className="stream-frequency-text">
            Interval: {streamIntervalMs / 1000}s
          </span>
        </div>

        <div className="stream-actions-group">
          <button
            className={`stream-btn ${isStreaming ? 'btn-pause' : 'btn-play'}`}
            onClick={toggleStreaming}
          >
            {isStreaming ? <Pause size={16} /> : <Play size={16} />}
            <span>{isStreaming ? 'PAUSE STREAM' : 'START CONTINUOUS STREAM'}</span>
          </button>

          <button
            className="btn-reset-baseline"
            onClick={handleResetToBaseline}
            title="Reset telemetry to nominal healthy baseline"
          >
            <RotateCw size={16} />
            <span>RESET TO HEALTHY</span>
          </button>

          <button
            className="btn-reset-machine"
            onClick={handleMachineReset}
            disabled={injecting}
            title="Reset the selected machine and simulation state"
          >
            <Cpu size={16} />
            <span>RESET MACHINE</span>
          </button>
        </div>
      </div>

      {statusMessage && (
        <div className={`sim-message-banner ${statusMessage.type}`}>
          {statusMessage.type === 'success' ? (
            <CheckCircle2 size={16} />
          ) : statusMessage.type === 'error' ? (
            <AlertTriangle size={16} />
          ) : (
            <Activity size={16} />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* TAB 1: PRESET SCENARIOS */}
      {activeTab === 'scenarios' && (
        <div className="scenarios-grid">
          {SCENARIOS.map((scenario) => {
            const Icon = scenario.icon
            const isSelected = selectedScenario === scenario.id

            return (
              <div
                key={scenario.id}
                className={`scenario-card ${isSelected ? 'selected' : ''}`}
                onClick={() => handleInjectScenario(scenario)}
              >
                <div className="scenario-card-header">
                  <div
                    className="scenario-icon-wrapper"
                    style={{ backgroundColor: `${scenario.color}20`, color: scenario.color }}
                  >
                    <Icon size={22} />
                  </div>
                  <div className="scenario-header-titles">
                    <span className="scenario-cat">{scenario.category}</span>
                    <strong className="scenario-name">{scenario.name}</strong>
                  </div>
                  <span
                    className={`scenario-badge badge-${scenario.badge.toLowerCase()}`}
                  >
                    {scenario.badge}
                  </span>
                </div>

                <p className="scenario-desc">{scenario.description}</p>

                <div className="scenario-key-params">
                  <div className="mini-chip">
                    <span>Vib:</span> <strong>{scenario.values.vibration} mm/s</strong>
                  </div>
                  <div className="mini-chip">
                    <span>Temp:</span> <strong>{scenario.values.motor_temperature} °C</strong>
                  </div>
                  <div className="mini-chip">
                    <span>Current:</span> <strong>{scenario.values.motor_current} A</strong>
                  </div>
                  <div className="mini-chip">
                    <span>RPM:</span> <strong>{scenario.values.rpm}</strong>
                  </div>
                </div>

                <button
                  className="inject-scenario-btn"
                  disabled={injecting}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleInjectScenario(scenario)
                  }}
                >
                  <Zap size={14} />
                  <span>INJECT SCENARIO TELEMETRY</span>
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* TAB 2: MANUAL CUSTOM SLIDERS */}
      {activeTab === 'sliders' && (
        <div className="custom-sliders-section">
          <p className="sliders-intro">
            Adjust individual physical machine parameters to test XGBoost decision boundaries and
            observe real-time SHAP attributions:
          </p>

          <div className="sliders-grid">
            {SLIDER_DEFINITIONS.map((def) => {
              const val = customParams[def.key] ?? def.min
              const isCrit =
                def.key === 'pressure' || def.key === 'motor_voltage' || def.key === 'rpm'
                  ? val <= def.critical
                  : val >= def.critical
              const isWarn =
                def.key === 'pressure' || def.key === 'motor_voltage' || def.key === 'rpm'
                  ? val <= def.warning && val > def.critical
                  : val >= def.warning && val < def.critical

              return (
                <div
                  className={`slider-control-card ${
                    isCrit ? 'card-critical' : isWarn ? 'card-warning' : ''
                  }`}
                  key={def.key}
                >
                  <div className="slider-label-row">
                    <span className="param-label">{def.label}</span>
                    <strong
                      className={`param-val ${
                        isCrit ? 'val-crit' : isWarn ? 'val-warn' : ''
                      }`}
                    >
                      {Number(val).toFixed(def.step < 1 ? 2 : 0)} {def.unit}
                    </strong>
                  </div>

                  <input
                    type="range"
                    min={def.min}
                    max={def.max}
                    step={def.step}
                    value={val}
                    onChange={(e) => handleSliderChange(def.key, e.target.value)}
                    className="telemetry-range-input"
                  />

                  <div className="slider-scale-row">
                    <span>{def.min} {def.unit}</span>
                    <span className="scale-limits">
                      Warn: {def.warning} | Crit: {def.critical}
                    </span>
                    <span>{def.max} {def.unit}</span>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="sliders-footer-action">
            <button
              className="btn-trigger-custom"
              disabled={injecting}
              onClick={() => executeInference(customParams, 'CUSTOM SLIDERS')}
            >
              <Cpu size={18} />
              <span>{injecting ? 'CALCULATING INFERENCE...' : 'EXECUTE PREDICTION ON SLIDER VALUES'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Live Feedback Summary */}
      {lastResult && (
        <div className="last-inference-tray">
          <div className="tray-item">
            <span className="tray-label">LAST CLASSIFICATION</span>
            <strong className={`tray-val val-${lastResult.state.toLowerCase()}`}>
              {lastResult.state}
            </strong>
          </div>
          <div className="tray-item">
            <span className="tray-label">PROBABILITY</span>
            <strong className="tray-val">
              {(lastResult.probability * 100).toFixed(2)}%
            </strong>
          </div>
          <div className="tray-item">
            <span className="tray-label">ANOMALY DETECTED</span>
            <strong
              className={`tray-val ${lastResult.isAnomaly ? 'val-crit' : 'val-safe'}`}
            >
              {lastResult.isAnomaly ? 'YES (ANOMALY)' : 'NO (NORMAL)'}
            </strong>
          </div>
          <div className="tray-item">
            <span className="tray-label">LATENCY</span>
            <strong className="tray-val">{lastResult.latencyMs} ms</strong>
          </div>
          <div className="tray-item">
            <span className="tray-label">SOURCE / TIME</span>
            <span className="tray-time">
              {lastResult.source} @ {lastResult.timestamp}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
