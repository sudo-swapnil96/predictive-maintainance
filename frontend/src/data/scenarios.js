import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Flame,
  Gauge,
} from 'lucide-react'

export const NOMINAL_BASELINE = {
  vibration: 0.38,
  motor_temperature: 45.0,
  motor_current: 3.7,
  motor_voltage: 230.0,
  rpm: 1450.0,
  pressure: 4.8,
  ambient_temperature: 24.0,
  humidity: 46.0,
}

export const SCENARIOS = [
  {
    id: 'nominal',
    name: '1. Nominal Continuous Operation',
    category: 'HEALTHY BASELINE',
    badge: 'NORMAL',
    color: '#35d69a',
    icon: CheckCircle2,
    description:
      'Optimal operating state. All physical sensor parameters well within ISO-10816 mechanical vibration and Class-F motor thermal envelopes.',
    values: { ...NOMINAL_BASELINE },
  },
  {
    id: 'bearing_degrading',
    name: '2. Incipient Bearing Degradation',
    category: 'EARLY WARNING',
    badge: 'DEGRADING',
    color: '#ffae42',
    icon: Activity,
    description:
      'Incipient outer-race spall. Micro-impacts generate elevated vibration and friction heat. Triggers Isolation Forest outlier detection.',
    values: {
      vibration: 1.45,
      motor_temperature: 58.5,
      motor_current: 4.6,
      motor_voltage: 228.0,
      rpm: 1410.0,
      pressure: 4.6,
      ambient_temperature: 25.0,
      humidity: 48.0,
    },
  },
  {
    id: 'stator_overheat',
    name: '3. Stator Core Thermal Runaway',
    category: 'ELECTRICAL FAULT',
    badge: 'FAULT',
    color: '#ff3b45',
    icon: Flame,
    description:
      'Ventilation blockage and winding turn-to-turn impedance drop. High current surge and stator winding temperature exceeding 85°C.',
    values: {
      vibration: 0.85,
      motor_temperature: 86.5,
      motor_current: 7.8,
      motor_voltage: 215.0,
      rpm: 1320.0,
      pressure: 4.2,
      ambient_temperature: 31.0,
      humidity: 62.0,
    },
  },
  {
    id: 'severe_bearing_fault',
    name: '4. Terminal Bearing Failure & Misalignment',
    category: 'MECHANICAL FAULT',
    badge: 'FAULT',
    color: '#ff3b45',
    icon: AlertTriangle,
    description:
      'Severe cage rupture, shaft eccentricity, and unbalance. Destructive vibration exceeding 2.8 mm/s with heavy thermal friction.',
    values: {
      vibration: 2.85,
      motor_temperature: 78.0,
      motor_current: 6.5,
      motor_voltage: 222.0,
      rpm: 1150.0,
      pressure: 3.8,
      ambient_temperature: 26.5,
      humidity: 50.0,
    },
  },
  {
    id: 'cavitation',
    name: '5. Hydraulic Cavitation & Line Pressure Drop',
    category: 'HYDRAULIC ANOMALY',
    badge: 'DEGRADING',
    color: '#31d7ff',
    icon: Gauge,
    description:
      'Fluid vapor bubble implosions causing delivery pressure drop below 2.5 Bar with high-frequency mechanical chatter.',
    values: {
      vibration: 1.65,
      motor_temperature: 63.5,
      motor_current: 5.2,
      motor_voltage: 226.0,
      rpm: 1380.0,
      pressure: 1.9,
      ambient_temperature: 25.5,
      humidity: 53.0,
    },
  },
]

export const SLIDER_DEFINITIONS = [
  { key: 'vibration', label: 'Vibration', unit: 'mm/s', min: 0.1, max: 3.5, step: 0.05, warning: 0.8, critical: 1.5 },
  { key: 'motor_temperature', label: 'Motor Temp', unit: '°C', min: 20, max: 105, step: 0.5, warning: 60, critical: 78 },
  { key: 'motor_current', label: 'Motor Current', unit: 'A', min: 1.0, max: 10.0, step: 0.1, warning: 5.2, critical: 6.8 },
  { key: 'motor_voltage', label: 'Motor Voltage', unit: 'V', min: 190, max: 250, step: 1, warning: 215, critical: 205 },
  { key: 'rpm', label: 'Rotational Speed', unit: 'RPM', min: 800, max: 1800, step: 10, warning: 1300, critical: 1100 },
  { key: 'pressure', label: 'System Pressure', unit: 'Bar', min: 0.5, max: 7.0, step: 0.1, warning: 3.2, critical: 2.2 },
  { key: 'ambient_temperature', label: 'Ambient Temp', unit: '°C', min: 15, max: 45, step: 0.5, warning: 35, critical: 40 },
  { key: 'humidity', label: 'Relative Humidity', unit: '%', min: 20, max: 95, step: 1, warning: 70, critical: 85 },
]

/**
 * Ensures all telemetry parameters are valid finite numbers with sane baseline fallbacks.
 * Prevents NaN / null values that cause FastAPI 422 validation rejections.
 */
export function sanitizeTelemetry(raw = {}) {
  const safe = (val, fallback, min = null, max = null) => {
    const num = Number(val)
    if (!Number.isFinite(num)) return fallback
    if (min !== null && num < min) return min
    if (max !== null && num > max) return max
    return num
  }

  return {
    vibration: safe(raw.vibration, NOMINAL_BASELINE.vibration, 0.05, 10.0),
    motor_temperature: safe(raw.motor_temperature, NOMINAL_BASELINE.motor_temperature, 10.0, 150.0),
    motor_current: safe(raw.motor_current, NOMINAL_BASELINE.motor_current, 0.1, 25.0),
    motor_voltage: safe(raw.motor_voltage, NOMINAL_BASELINE.motor_voltage, 100.0, 300.0),
    rpm: safe(raw.rpm, NOMINAL_BASELINE.rpm, 100.0, 3000.0),
    pressure: safe(raw.pressure, NOMINAL_BASELINE.pressure, 0.1, 15.0),
    ambient_temperature: safe(raw.ambient_temperature, NOMINAL_BASELINE.ambient_temperature, -10.0, 60.0),
    humidity: safe(raw.humidity, NOMINAL_BASELINE.humidity, 5.0, 100.0),
  }
}

/**
 * Adds realistic Gaussian/uniform jitter around current parameters for live simulation streaming.
 */
export function generateStreamJitter(prevTelemetry = {}) {
  const base = sanitizeTelemetry(prevTelemetry)
  const jitter = (val, pct = 0.02) => {
    const delta = (Math.random() - 0.5) * 2 * (val * pct)
    return Number((val + delta).toFixed(2))
  }

  return sanitizeTelemetry({
    vibration: jitter(base.vibration, 0.04),
    motor_temperature: jitter(base.motor_temperature, 0.015),
    motor_current: jitter(base.motor_current, 0.025),
    motor_voltage: jitter(base.motor_voltage, 0.01),
    rpm: jitter(base.rpm, 0.01),
    pressure: jitter(base.pressure, 0.03),
    ambient_temperature: base.ambient_temperature,
    humidity: base.humidity,
  })
}
