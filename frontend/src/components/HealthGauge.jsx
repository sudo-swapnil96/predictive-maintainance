import React from 'react'

export function HealthGauge({ score = 95, health = 'HEALTHY', size = 180 }) {
  const radius = (size - 24) / 2
  const circumference = 2 * Math.PI * radius
  // Show 270 degree arc (3/4 circle)
  const totalArc = circumference * 0.75
  const strokeDashoffset = totalArc - (Math.min(Math.max(score, 0), 100) / 100) * totalArc

  const getColor = () => {
    if (score >= 75) return { stroke: '#35d69a', glow: 'rgba(53, 214, 154, 0.4)', name: 'HEALTHY' }
    if (score >= 40) return { stroke: '#ffae42', glow: 'rgba(255, 174, 66, 0.4)', name: 'WARNING' }
    return { stroke: '#ff3b45', glow: 'rgba(255, 59, 69, 0.5)', name: 'CRITICAL' }
  }

  const { stroke, glow } = getColor()

  return (
    <div className="health-gauge-container" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="health-gauge-svg"
      >
        <defs>
          <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.8" />
            <stop offset="100%" stopColor={stroke} stopOpacity="1" />
          </linearGradient>
          <filter id="gaugeGlow">
            <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor={stroke} floodOpacity="0.6" />
          </filter>
        </defs>

        {/* Background Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255, 255, 255, 0.08)"
          strokeWidth="10"
          strokeDasharray={`${totalArc} ${circumference}`}
          strokeDashoffset="0"
          strokeLinecap="round"
          transform={`rotate(135 ${size / 2} ${size / 2})`}
        />

        {/* Active Animated Value Arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="url(#gaugeGradient)"
          strokeWidth="11"
          strokeDasharray={`${totalArc} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          filter="url(#gaugeGlow)"
          transform={`rotate(135 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1)' }}
        />
      </svg>

      <div className="gauge-center-content">
        <span className="gauge-label">ASSET HEALTH</span>
        <strong className="gauge-value" style={{ color: stroke }}>
          {score}
          <span className="gauge-unit">%</span>
        </strong>
        <span
          className="gauge-health-pill"
          style={{
            borderColor: stroke,
            color: stroke,
            backgroundColor: glow,
          }}
        >
          {health}
        </span>
      </div>
    </div>
  )
}
