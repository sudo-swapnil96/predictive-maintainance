import React from 'react'
import {
  Activity,
  AlertTriangle,
  Award,
  Clock,
  Gauge,
  ShieldAlert,
  ShieldCheck,
  TrendingDown,
  Wrench,
} from 'lucide-react'

export function PrognosticsRUL({
  predictionState = 'NORMAL',
  healthScore = 95,
  telemetry = {},
  operatingHours = 1240,
}) {
  const vibration = Number(telemetry.vibration) || 0.4
  const temp = Number(telemetry.motor_temperature) || 45.0

  // Dynamic RUL Calculation (Hours)
  const calculateRUL = () => {
    if (predictionState === 'FAULT') {
      // Critical state: rapid exponential decay toward 0
      const base = 18.5
      const penalty = Math.max(0, (vibration - 1.5) * 4 + (temp - 70) * 0.4)
      return Math.max(4.2, Number((base - penalty).toFixed(1)))
    }
    if (predictionState === 'DEGRADING') {
      // Degrading state: intermediate warning window
      const base = 142.0
      const penalty = Math.max(0, (vibration - 0.8) * 45 + (temp - 55) * 2.5)
      return Math.max(28.0, Number((base - penalty).toFixed(1)))
    }
    // Normal healthy state
    return Number((840.0 + (healthScore - 80) * 15).toFixed(0))
  }

  const rulHours = calculateRUL()

  // P-F Curve Progress (0% = Healthy Normal, 100% = Functional Failure)
  const calculatePFCurvePosition = () => {
    if (predictionState === 'FAULT') {
      return Math.min(95, 75 + ((vibration - 1.5) / 2.0) * 20)
    }
    if (predictionState === 'DEGRADING') {
      return Math.min(68, 35 + ((vibration - 0.8) / 0.7) * 25)
    }
    return Math.max(5, (100 - healthScore) * 1.2)
  }

  const pfProgress = calculatePFCurvePosition()

  // SVG P-F Curve Geometry
  const svgW = 680
  const svgH = 220
  const pad = { top: 30, right: 40, bottom: 40, left: 50 }
  const graphW = svgW - pad.left - pad.right
  const graphH = svgH - pad.top - pad.bottom

  // Cubic Bezier curve representing the classic P-F decay curve
  // Curve starts high (health=100%), stays flat, then drops steeply toward Point F
  const p0 = { x: pad.left, y: pad.top + 10 }
  const p1 = { x: pad.left + graphW * 0.4, y: pad.top + 20 }
  const p2 = { x: pad.left + graphW * 0.75, y: pad.top + graphH * 0.6 }
  const p3 = { x: pad.left + graphW, y: pad.top + graphH }

  const curveD = `M ${p0.x} ${p0.y} C ${p1.x} ${p1.y}, ${p2.x} ${p2.y}, ${p3.x} ${p3.y}`

  // Calculate coordinates of Point along cubic bezier by t
  const getBezierPoint = (t) => {
    const u = 1 - t
    const tt = t * t
    const uu = u * u
    const uuu = uu * u
    const ttt = tt * t

    let x = uuu * p0.x
    x += 3 * uu * t * p1.x
    x += 3 * u * tt * p2.x
    x += ttt * p3.x

    let y = uuu * p0.y
    y += 3 * uu * t * p1.y
    y += 3 * u * tt * p2.y
    y += ttt * p3.y

    return { x, y }
  }

  const currentMarker = getBezierPoint(pfProgress / 100)
  const pointP = getBezierPoint(0.35) // Point P (Potential Failure / Incipient Wear)
  const pointF = getBezierPoint(0.95) // Point F (Functional Failure)

  return (
    <div className="prognostics-panel panel">
      <div className="panel-header">
        <div>
          <p className="section-label">ASSET PROGNOSTICS & RELIABILITY MODELING</p>
          <h2>Remaining Useful Life (RUL) & P-F Degradation Curve</h2>
        </div>
        <div className={`rul-state-badge state-${predictionState.toLowerCase()}`}>
          {predictionState === 'FAULT'
            ? 'CRITICAL DEGRADATION'
            : predictionState === 'DEGRADING'
            ? 'PROGRESSIVE WEAR'
            : 'OPTIMAL RELIABILITY'}
        </div>
      </div>

      {/* TOP KPI CARDS */}
      <div className="prognostics-kpi-grid">
        <div className={`rul-kpi-card ${predictionState === 'FAULT' ? 'kpi-danger' : predictionState === 'DEGRADING' ? 'kpi-warning' : 'kpi-safe'}`}>
          <div className="kpi-icon">
            <Clock size={28} />
          </div>
          <div className="kpi-body">
            <span className="kpi-label">ESTIMATED REMAINING USEFUL LIFE</span>
            <strong className="kpi-value">
              {rulHours} <span className="kpi-unit">HOURS</span>
            </strong>
            <span className="kpi-sub">
              {predictionState === 'FAULT'
                ? 'Mandatory immediate service required'
                : predictionState === 'DEGRADING'
                ? 'Schedule maintenance within 48h'
                : 'Nominal operational life cycle'}
            </span>
          </div>
        </div>

        <div className="rul-kpi-card">
          <div className="kpi-icon blue">
            <TrendingDown size={28} />
          </div>
          <div className="kpi-body">
            <span className="kpi-label">DEGRADATION TRAJECTORY</span>
            <strong className="kpi-value">
              {pfProgress.toFixed(1)} <span className="kpi-unit">% ADVANCED</span>
            </strong>
            <span className="kpi-sub">Position along failure progression curve</span>
          </div>
        </div>

        <div className="rul-kpi-card">
          <div className="kpi-icon orange">
            <Wrench size={28} />
          </div>
          <div className="kpi-body">
            <span className="kpi-label">ACTION WINDOW</span>
            <strong className="kpi-value">
              {predictionState === 'FAULT'
                ? '< 12 HRS'
                : predictionState === 'DEGRADING'
                ? '48 - 72 HRS'
                : 'ROUTINE (30D)'}
            </strong>
            <span className="kpi-sub">Recommended maintenance window</span>
          </div>
        </div>

        <div className="rul-kpi-card">
          <div className="kpi-icon green">
            <Award size={28} />
          </div>
          <div className="kpi-body">
            <span className="kpi-label">COST AVOIDANCE BENEFIT</span>
            <strong className="kpi-value">$14,500+</strong>
            <span className="kpi-sub">Estimated catastrophic downtime prevented</span>
          </div>
        </div>
      </div>

      {/* P-F CURVE VISUALIZATION */}
      <div className="pf-curve-container">
        <div className="pf-curve-header">
          <div>
            <h3>Interactive P-F (Potential to Functional Failure) Curve</h3>
            <p className="pf-subtitle">
              Visualizes the asset degradation interval from incipient anomaly detection (Point P)
              to functional collapse (Point F).
            </p>
          </div>
          <div className="pf-legend">
            <span className="legend-point p">● Point P: Incipient Defect</span>
            <span className="legend-point current">● Current Asset Status</span>
            <span className="legend-point f">● Point F: Functional Failure</span>
          </div>
        </div>

        <div className="pf-svg-wrapper">
          <svg
            viewBox={`0 0 ${svgW} ${svgH}`}
            className="pf-svg"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="pfGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#35d69a" />
                <stop offset="45%" stopColor="#31d7ff" />
                <stop offset="70%" stopColor="#ffae42" />
                <stop offset="100%" stopColor="#ff3b45" />
              </linearGradient>
              <filter id="pfMarkerGlow">
                <feDropShadow dx="0" dy="0" stdDeviation="5" floodColor="#ffffff" floodOpacity="0.8" />
              </filter>
            </defs>

            {/* Axes */}
            <line
              x1={pad.left}
              y1={pad.top + graphH}
              x2={svgW - pad.right}
              y2={pad.top + graphH}
              stroke="#17334d"
              strokeWidth="1.5"
            />
            <line
              x1={pad.left}
              y1={pad.top}
              x2={pad.left}
              y2={pad.top + graphH}
              stroke="#17334d"
              strokeWidth="1.5"
            />

            {/* Axis Labels */}
            <text
              x={pad.left}
              y={pad.top - 10}
              fill="#7b96b0"
              fontSize="11"
              fontFamily="Exo 2, sans-serif"
            >
              ▲ Machine Health Condition
            </text>
            <text
              x={svgW - pad.right}
              y={pad.top + graphH + 25}
              fill="#7b96b0"
              fontSize="11"
              textAnchor="end"
              fontFamily="Exo 2, sans-serif"
            >
              Operating Time (Hours) ▶
            </text>

            {/* P-F Degradation Curve Line */}
            <path
              d={curveD}
              fill="none"
              stroke="url(#pfGradient)"
              strokeWidth="3.5"
              strokeLinecap="round"
            />

            {/* Point P (Incipient Anomaly) Marker */}
            <circle cx={pointP.x} cy={pointP.y} r="5" fill="#ffae42" stroke="#ffffff" strokeWidth="1.5" />
            <line
              x1={pointP.x}
              y1={pointP.y}
              x2={pointP.x}
              y2={pad.top + graphH}
              stroke="#ffae42"
              strokeWidth="1"
              strokeDasharray="3 3"
              opacity="0.6"
            />
            <text
              x={pointP.x}
              y={pointP.y - 12}
              fill="#ffae42"
              fontSize="11"
              fontWeight="600"
              textAnchor="middle"
              fontFamily="Orbitron, sans-serif"
            >
              POINT P (Anomaly Detected)
            </text>

            {/* Point F (Functional Failure) Marker */}
            <circle cx={pointF.x} cy={pointF.y} r="5" fill="#ff3b45" stroke="#ffffff" strokeWidth="1.5" />
            <text
              x={pointF.x}
              y={pointF.y - 12}
              fill="#ff3b45"
              fontSize="11"
              fontWeight="600"
              textAnchor="end"
              fontFamily="Orbitron, sans-serif"
            >
              POINT F (Functional Failure)
            </text>

            {/* Current Asset Marker with Live Pulse */}
            <circle
              cx={currentMarker.x}
              cy={currentMarker.y}
              r="12"
              fill="none"
              stroke={
                predictionState === 'FAULT'
                  ? '#ff3b45'
                  : predictionState === 'DEGRADING'
                  ? '#ffae42'
                  : '#31d7ff'
              }
              strokeWidth="2"
              className="pf-pulse-ring"
            />
            <circle
              cx={currentMarker.x}
              cy={currentMarker.y}
              r="6"
              fill="#ffffff"
              stroke={
                predictionState === 'FAULT'
                  ? '#ff3b45'
                  : predictionState === 'DEGRADING'
                  ? '#ffae42'
                  : '#31d7ff'
              }
              strokeWidth="2.5"
              filter="url(#pfMarkerGlow)"
            />
          </svg>
        </div>

        <div className="pf-curve-footer">
          <div className="pf-status-box">
            <span className="status-title">CURRENT STATUS ON P-F CURVE:</span>
            <strong className="status-text">
              {predictionState === 'FAULT'
                ? 'Terminal Stage: Past Point P, rapidly approaching Point F (Catastrophic Risk)'
                : predictionState === 'DEGRADING'
                ? 'Developing Stage: Approaching Point P (Noticeable mechanical wear & thermal drift)'
                : 'Nominal Stage: Proactive monitoring zone, healthy operating condition'}
            </strong>
          </div>
        </div>
      </div>
    </div>
  )
}
