import React, { useState } from 'react'
import { Activity, Flame, Gauge, Zap } from 'lucide-react'

export function TelemetryCharts({ history = [] }) {
  const [selectedMetric, setSelectedMetric] = useState('vibration')

  const metricConfigs = {
    vibration: {
      label: 'VIBRATION DYNAMICS',
      unit: 'mm/s',
      icon: Activity,
      color: '#31d7ff',
      glow: 'rgba(49, 215, 255, 0.25)',
      warning: 0.8,
      critical: 1.5,
      min: 0,
      max: 3.2,
      description: 'Bearing and mechanical rotational oscillation amplitude.',
    },
    motor_temperature: {
      label: 'STATOR TEMPERATURE',
      unit: '°C',
      icon: Flame,
      color: '#ffae42',
      glow: 'rgba(255, 174, 66, 0.25)',
      warning: 60.0,
      critical: 78.0,
      min: 20,
      max: 100,
      description: 'Motor internal winding and stator thermal profile.',
    },
    motor_current: {
      label: 'PHASE CURRENT',
      unit: 'A',
      icon: Zap,
      color: '#a66cff',
      glow: 'rgba(166, 108, 255, 0.25)',
      warning: 5.2,
      critical: 6.8,
      min: 0,
      max: 10.0,
      description: 'Motor electrical load and current draw balance.',
    },
    pressure: {
      label: 'LINE PRESSURE',
      unit: 'Bar',
      icon: Gauge,
      color: '#35d69a',
      glow: 'rgba(53, 214, 154, 0.25)',
      warning: 3.5,
      critical: 2.5,
      min: 0,
      max: 7.0,
      description: 'Hydraulic and pneumatic delivery line pressure.',
    },
  }

  const currentConfig = metricConfigs[selectedMetric]
  const dataPoints = history.map((item) => Number(item[selectedMetric]) || 0)

  // Fallback points if history is short
  const points =
    dataPoints.length > 0
      ? dataPoints
      : [0.4, 0.42, 0.41, 0.39, 0.44, 0.43, 0.41, 0.45]

  const currentVal = points[points.length - 1] ?? 0
  const minVal = Math.min(...points)
  const maxVal = Math.max(...points)
  const avgVal = points.reduce((a, b) => a + b, 0) / points.length

  // SVG Chart Dimensions
  const width = 680
  const height = 220
  const padding = { top: 25, right: 30, bottom: 35, left: 45 }
  const chartW = width - padding.left - padding.right
  const chartH = height - padding.top - padding.bottom

  const scaleY = (val) => {
    const range = currentConfig.max - currentConfig.min
    const norm = (val - currentConfig.min) / (range || 1)
    return padding.top + chartH - Math.max(0, Math.min(norm, 1)) * chartH
  }

  const scaleX = (index) => {
    const total = Math.max(points.length - 1, 1)
    return padding.left + (index / total) * chartW
  }

  // Generate SVG Path
  const pathD = points
    .map((val, idx) => {
      const x = scaleX(idx)
      const y = scaleY(val)
      return idx === 0 ? `M ${x} ${y}` : `L ${x} ${y}`
    })
    .join(' ')

  const areaD = points.length > 0
    ? `${pathD} L ${scaleX(points.length - 1)} ${padding.top + chartH} L ${padding.left} ${padding.top + chartH} Z`
    : ''

  const warningY = scaleY(currentConfig.warning)
  const criticalY = scaleY(currentConfig.critical)

  const isWarning =
    selectedMetric === 'pressure'
      ? currentVal <= currentConfig.warning && currentVal > currentConfig.critical
      : currentVal >= currentConfig.warning && currentVal < currentConfig.critical

  const isCritical =
    selectedMetric === 'pressure'
      ? currentVal <= currentConfig.critical
      : currentVal >= currentConfig.critical

  return (
    <div className="telemetry-charts-panel panel">
      <div className="panel-header">
        <div>
          <p className="section-label">CONTINUOUS TIME-SERIES TELEMETRY</p>
          <h2>Real-Time Dynamic Sensor Trends</h2>
        </div>
        <div className="metric-selector-tabs">
          {Object.entries(metricConfigs).map(([key, cfg]) => {
            const Icon = cfg.icon
            const active = selectedMetric === key
            return (
              <button
                key={key}
                className={`metric-tab ${active ? 'active' : ''}`}
                onClick={() => setSelectedMetric(key)}
              >
                <Icon size={14} />
                <span>{key.replace('_', ' ').toUpperCase()}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="chart-stats-banner">
        <div className="chart-stat-item">
          <span className="stat-label">CURRENT</span>
          <strong
            className="stat-val"
            style={{
              color: isCritical
                ? '#ff3b45'
                : isWarning
                ? '#ffae42'
                : currentConfig.color,
            }}
          >
            {currentVal.toFixed(2)} {currentConfig.unit}
          </strong>
        </div>
        <div className="chart-stat-item">
          <span className="stat-label">MINIMUM</span>
          <strong className="stat-val">
            {minVal.toFixed(2)} {currentConfig.unit}
          </strong>
        </div>
        <div className="chart-stat-item">
          <span className="stat-label">MAXIMUM</span>
          <strong className="stat-val">
            {maxVal.toFixed(2)} {currentConfig.unit}
          </strong>
        </div>
        <div className="chart-stat-item">
          <span className="stat-label">AVERAGE</span>
          <strong className="stat-val">
            {avgVal.toFixed(2)} {currentConfig.unit}
          </strong>
        </div>
        <div className="chart-stat-item">
          <span className="stat-label">STATUS</span>
          <span
            className={`status-pill ${
              isCritical
                ? 'pill-critical'
                : isWarning
                ? 'pill-warning'
                : 'pill-normal'
            }`}
          >
            {isCritical ? 'CRITICAL LIMIT' : isWarning ? 'WARNING BAND' : 'NOMINAL SAFE'}
          </span>
        </div>
      </div>

      <div className="svg-chart-wrapper">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="telemetry-svg"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id={`areaGrad-${selectedMetric}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={currentConfig.color} stopOpacity="0.3" />
              <stop offset="100%" stopColor={currentConfig.color} stopOpacity="0.0" />
            </linearGradient>
            <filter id="chartGlow">
              <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor={currentConfig.color} floodOpacity="0.5" />
            </filter>
          </defs>

          {/* Grid lines */}
          <line
            x1={padding.left}
            y1={padding.top + chartH}
            x2={width - padding.right}
            y2={padding.top + chartH}
            stroke="#17334d"
            strokeWidth="1"
          />
          <line
            x1={padding.left}
            y1={padding.top}
            x2={width - padding.right}
            y2={padding.top}
            stroke="#17334d"
            strokeWidth="1"
            strokeDasharray="4 4"
          />

          {/* Warning Limit Line */}
          <line
            x1={padding.left}
            y1={warningY}
            x2={width - padding.right}
            y2={warningY}
            stroke="#ffae42"
            strokeWidth="1"
            strokeDasharray="5 5"
            opacity="0.85"
          />
          <text
            x={width - padding.right - 5}
            y={warningY - 5}
            fill="#ffae42"
            fontSize="10"
            textAnchor="end"
            fontFamily="Orbitron, sans-serif"
          >
            WARNING: {currentConfig.warning} {currentConfig.unit}
          </text>

          {/* Critical Limit Line */}
          <line
            x1={padding.left}
            y1={criticalY}
            x2={width - padding.right}
            y2={criticalY}
            stroke="#ff3b45"
            strokeWidth="1"
            strokeDasharray="4 4"
            opacity="0.9"
          />
          <text
            x={width - padding.right - 5}
            y={criticalY - 5}
            fill="#ff3b45"
            fontSize="10"
            textAnchor="end"
            fontFamily="Orbitron, sans-serif"
          >
            CRITICAL: {currentConfig.critical} {currentConfig.unit}
          </text>

          {/* Fill area under curve */}
          {areaD && (
            <path
              d={areaD}
              fill={`url(#areaGrad-${selectedMetric})`}
            />
          )}

          {/* Trendline */}
          {pathD && (
            <path
              d={pathD}
              fill="none"
              stroke={currentConfig.color}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#chartGlow)"
            />
          )}

          {/* Point nodes & Latest pulsing dot */}
          {points.map((val, idx) => {
            const x = scaleX(idx)
            const y = scaleY(val)
            const isLatest = idx === points.length - 1

            return (
              <g key={idx}>
                {isLatest && (
                  <circle
                    cx={x}
                    cy={y}
                    r="8"
                    fill="none"
                    stroke={currentConfig.color}
                    strokeWidth="1.5"
                    className="chart-pulse-ring"
                  />
                )}
                <circle
                  cx={x}
                  cy={y}
                  r={isLatest ? '5' : '2.5'}
                  fill={isLatest ? '#ffffff' : currentConfig.color}
                  stroke={currentConfig.color}
                  strokeWidth="1.5"
                />
              </g>
            )
          })}
        </svg>
      </div>

      <div className="chart-legend-row">
        <span>● Safe Zone: &lt;{currentConfig.warning} {currentConfig.unit}</span>
        <span className="legend-warning">--- Warning Limit: {currentConfig.warning} {currentConfig.unit}</span>
        <span className="legend-critical">--- Critical Threshold: {currentConfig.critical} {currentConfig.unit}</span>
        <span className="legend-note">{currentConfig.description}</span>
      </div>
    </div>
  )
}
