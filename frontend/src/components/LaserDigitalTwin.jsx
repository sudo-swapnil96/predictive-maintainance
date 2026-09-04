import { useState } from 'react'
import {
  AlertTriangle,
  Award,
  Box,
  Crosshair,
  Flame,
  Layers,
  Pause,
  Play,
  ShieldCheck,
  Zap,
} from 'lucide-react'
import { ThreeLaserTwin } from './ThreeLaserTwin'
import { SCENARIOS } from '../data/scenarios'

export function LaserDigitalTwin({
  machineName = "Han's Laser Fiber Marking Station",
  predictionState = 'NORMAL',
  healthScore = 96,
  telemetry = {},
  onSelectScenario,
  onOpenWorkOrder,
  isStreaming = false,
  onToggleStreaming,
  streamCount = 0,
}) {
  const [viewMode, setViewMode] = useState('3d') // '3d' | 'schematic'
  const [activeSubsystem, setActiveSubsystem] = useState('galvo')
  const [selectedWorkpiece, setSelectedWorkpiece] = useState('watch')
  const [beamActive, setBeamActive] = useState(true)
  const [beamPosition, setBeamPosition] = useState({ x: 50, y: 50 })


  const vibration = Number(telemetry.vibration) || 0.4
  const temp = Number(telemetry.motor_temperature) || 45.0
  const current = Number(telemetry.motor_current) || 3.8
  const voltage = Number(telemetry.motor_voltage) || 230.0
  const rpm = Number(telemetry.rpm) || 1450.0
  const pressure = Number(telemetry.pressure) || 4.8

  // Laser galvo scanning velocity mapped from RPM parameter (galvo vector speed)
  const markSpeedMmS = Math.round(rpm * 1.8) // e.g. 2600 mm/s
  // Laser optical output power derived from voltage and current
  const opticalPowerWatts = Math.min(50, Math.max(10, ((voltage * current) / 100) * 1.9)).toFixed(1)

  // Subsystem health evaluation
  const isGalvoCritical = vibration >= 1.5
  const isGalvoWarning = vibration >= 0.8 && vibration < 1.5

  const isLaserCritical = temp >= 75
  const isLaserWarning = temp >= 58 && temp < 75

  const isPowerCritical = current >= 6.8 || voltage < 205
  const isPowerWarning = (current >= 5.2 && current < 6.8) || (voltage >= 205 && voltage < 218)

  const isExtractionCritical = pressure <= 2.2
  const isExtractionWarning = pressure > 2.2 && pressure <= 3.2

  const workpieces = [
    {
      id: 'watch',
      title: 'Watch Case Back',
      material: 'AISI 316L Stainless Steel',
      technique: 'Laser Annealing / Dark Marking',
      details: 'Betsey Johnson BJ00358-02, 3 ATM Water Resistant, Battery SR626SW',
      powerSetting: '22.5 W',
      frequency: '35 kHz',
      speed: '1200 mm/s',
    },
    {
      id: 'automotive',
      title: 'Automotive Throttle Body',
      material: 'Die-Cast Aluminum A380',
      technique: 'Deep Laser Etching & Traceability',
      details: 'Part Identification Code: HB99 28286663 with 2D DataMatrix',
      powerSetting: '32.0 W',
      frequency: '28 kHz',
      speed: '800 mm/s',
    },
    {
      id: 'eartag',
      title: 'Livestock Identification Tag',
      material: 'High-Density Polyurethane (Yellow)',
      technique: 'Carbon Foaming Laser Marking',
      details: 'UPLDB Registry Tag: 190073 041986 with Code-128 Barcode',
      powerSetting: '18.0 W',
      frequency: '45 kHz',
      speed: '2500 mm/s',
    },
    {
      id: 'pendant',
      title: 'Artisan Brass Medallion',
      material: 'Cartridge Brass (CuZn30)',
      technique: 'Contour Vector Cutting & Fine Relief',
      details: 'Commemorative "TEMA * 15.06.1977" with cut-out "福" (Fortune)',
      powerSetting: '48.0 W',
      frequency: '20 kHz',
      speed: '350 mm/s',
    },
  ]

  const activeWorkpieceData = workpieces.find((w) => w.id === selectedWorkpiece) || workpieces[0]

  const subsystems = {
    galvo: {
      name: 'High-Speed Dual-Axis Galvo Scanner',
      sensor: 'Vibration & Mirror Acceleration',
      measured: `${vibration.toFixed(2)} mm/s`,
      normalRange: '0.10 - 0.75 mm/s',
      status: isGalvoCritical ? 'CRITICAL' : isGalvoWarning ? 'WARNING' : 'HEALTHY',
      color: isGalvoCritical ? '#ff3b45' : isGalvoWarning ? '#ffae42' : '#35d69a',
      description:
        'Dual moving-magnet galvanometer optical scanning motors with high-reflectivity dielectric beryllium mirrors and F-Theta telecentric lens.',
      failureMode:
        'Bearing cage micro-spalling, mirror thermal unbalance, galvo rotor oscillation, and optical trajectory distortion.',
      action: isGalvoCritical
        ? 'Immediately halt marking job. Perform precision laser interferometer calibration and replace Galvo-X bearing cartridge.'
        : isGalvoWarning
        ? 'Schedule optical zero-point realignment and clean protective optic window.'
        : 'Galvo positioning accuracy within nominal ±0.002 mm tolerance envelope.',
    },
    laser_source: {
      name: 'Solid-State Fiber Laser Oscillator',
      sensor: 'Cavity & Winding Temperature',
      measured: `${temp.toFixed(1)} °C`,
      normalRange: '25.0 - 55.0 °C',
      status: isLaserCritical ? 'CRITICAL' : isLaserWarning ? 'WARNING' : 'HEALTHY',
      color: isLaserCritical ? '#ff3b45' : isLaserWarning ? '#ffae42' : '#35d69a',
      description:
        '1064nm Ytterbium-doped pulsed fiber laser source module mounted inside the lower chassis compartment with forced-air thermal dissipation.',
      failureMode:
        'Pump diode overheating, fiber Bragg grating thermal shift, output power degradation, and Class-F insulation breakdown.',
      action: isLaserCritical
        ? 'Critical thermal runaway risk. Inspect cooling air intake louvers, check internal cooling fans, and reduce laser duty cycle.'
        : isLaserWarning
        ? 'Clean chassis air dust filtration mesh and check ambient exhaust clearance.'
        : 'Laser optical cavity temperature operates in optimal Class-A envelope.',
    },
    power_system: {
      name: 'Industrial DC Power Supply & RF Driver',
      sensor: 'Phase Current & Supply Voltage',
      measured: `${current.toFixed(1)} A / ${voltage.toFixed(0)} V`,
      normalRange: '3.0 - 5.0 A / 220 - 240 V',
      status: isPowerCritical ? 'CRITICAL' : isPowerWarning ? 'WARNING' : 'HEALTHY',
      color: isPowerCritical ? '#ff3b45' : isPowerWarning ? '#ffae42' : '#35d69a',
      description:
        'Switch-mode power supply delivering stabilized 24V DC to galvo drivers and high-current pulsed DC to the laser diode module.',
      failureMode:
        'Phase voltage fluctuation, electrolytic capacitor ESR surge, and RF driver impedance mismatch.',
      action: isPowerCritical
        ? 'Audit main 230V AC supply lines and check terminal blocks for loose connections.'
        : 'Power rail voltages stable within ±1.5% ripple margin.',
    },
    exhaust: {
      name: 'Fume Extraction & Pneumatics',
      sensor: 'Exhaust Line Pressure',
      measured: `${pressure.toFixed(1)} Bar`,
      normalRange: '3.5 - 6.0 Bar',
      status: isExtractionCritical ? 'CRITICAL' : isExtractionWarning ? 'WARNING' : 'HEALTHY',
      color: isExtractionCritical ? '#ff3b45' : isExtractionWarning ? '#ffae42' : '#35d69a',
      description:
        'HEPA / Carbon particulate fume extraction and workpiece pneumatic clamping delivery line.',
      failureMode:
        'Particulate filter saturation, suction hose restriction, and air manifold seal leaks.',
      action: isExtractionCritical
        ? 'Replace HEPA/carbon filter element and inspect suction nozzle position.'
        : 'Exhaust negative pressure guarantees 100% ablation fume evacuation.',
    },
  }

  const currentSubsystem = subsystems[activeSubsystem] || subsystems.galvo

  return (
    <div className="laser-twin-wrapper page-content">
      {/* Top Header */}
      <div className="page-heading">
        <div className="twin-title-left">
          <p className="section-label">CYBER-PHYSICAL INDUSTRIAL TWIN</p>
          <h2>Han's Laser Marking Station Digital Twin</h2>
          <p className="page-description">
            High-fidelity cyber-physical virtual replica of the <strong>Han's Laser Fiber Marking System</strong>.
            Synchronizes real-time optical scan dynamics, laser thermal profile, and work-surface ablation in real time.
          </p>
        </div>

        <div className="machine-badge-banner">
          <div className="brand-logo-pill">
            <span className="logo-text">HAN'S LASER</span>
            <span className="model-text">FIBER SERIES</span>
          </div>
          <div className={`twin-health-pill health-${healthScore >= 75 ? 'healthy' : healthScore >= 40 ? 'warning' : 'critical'}`}>
            <span className="pulse-dot" />
            <span>ASSET HEALTH: {healthScore}%</span>
          </div>
        </div>
      </div>

      {/* VIEW MODE TABS: 3D INTERACTIVE vs 2.5D SCHEMATIC */}
      <div className="twin-viewmode-bar">
        <button
          className={`viewmode-btn ${viewMode === '3d' ? 'active' : ''}`}
          onClick={() => setViewMode('3d')}
        >
          <Box size={16} />
          <span>3D INTERACTIVE MODEL (AUTO-OPEN & PINPOINT FAULT)</span>
        </button>
        <button
          className={`viewmode-btn ${viewMode === 'schematic' ? 'active' : ''}`}
          onClick={() => setViewMode('schematic')}
        >
          <Layers size={16} />
          <span>2.5D SCHEMATIC & REAL WORKPIECE ABLATION</span>
        </button>
      </div>

      {/* 1-CLICK QUICK FAULT SIMULATION & STREAMING RIBBON FOR TWIN */}
      <div className="twin-simulation-ribbon panel">
        <div className="twin-sim-left">
          <Zap size={16} className="text-cyan" />
          <strong>3D Machine Fault Injection & Testing:</strong>
          <span className="twin-sim-hint">Trigger physical state transition to test 3D auto-open & component highlighting:</span>
        </div>
        <div className="twin-sim-buttons">
          {SCENARIOS.map((s) => (
            <button
              key={s.id}
              className={`twin-scenario-chip chip-${s.badge.toLowerCase()}`}
              onClick={() => onSelectScenario && onSelectScenario(s)}
              title={s.description}
            >
              <span className="chip-badge">{s.badge}</span>
              <span className="chip-name">{s.name.split('.')[1] || s.name}</span>
            </button>
          ))}
        </div>
        {onToggleStreaming && (
          <div className="twin-sim-stream-toggle">
            <button
              className={`twin-stream-btn ${isStreaming ? 'active-streaming' : ''}`}
              onClick={onToggleStreaming}
              title={isStreaming ? 'Pause continuous simulation stream' : 'Start continuous simulation stream'}
            >
              {isStreaming ? <Pause size={14} /> : <Play size={14} />}
              <span>{isStreaming ? `STREAMING (#${streamCount})` : 'START LIVE STREAM'}</span>
            </button>
          </div>
        )}
      </div>

      {viewMode === '3d' ? (
        <ThreeLaserTwin
          machineName={machineName}
          predictionState={predictionState}
          healthScore={healthScore}
          telemetry={telemetry}
          onOpenWorkOrder={onOpenWorkOrder}
        />
      ) : (
        <>
          {/* WORKPIECE TARGET SELECTOR RIBBON */}
          <div className="workpiece-selector-bar panel">
            <div className="workpiece-bar-header">
              <Crosshair size={16} className="text-cyan" />
              <strong>Active Workpiece Material & Job Specification:</strong>

          <span className="workpiece-sub-text">Switch physical target to observe laser-material interaction:</span>
        </div>

        <div className="workpiece-chips-row">
          {workpieces.map((wp) => (
            <button
              key={wp.id}
              className={`workpiece-chip ${selectedWorkpiece === wp.id ? 'active' : ''}`}
              onClick={() => setSelectedWorkpiece(wp.id)}
            >
              <span className="wp-dot" />
              <div className="wp-chip-text">
                <strong>{wp.title}</strong>
                <small>{wp.material.split(' ')[0]}</small>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* MAIN 2.5D INTERACTIVE SCHEMATIC VIEWPORT */}
      <div className="twin-main-grid">
        {/* LEFT COLUMN: THE PHYSICAL LASER MACHINE SCHEMATIC */}
        <div className="twin-canvas-card panel">
          {/* HUD Overlay Bar */}
          <div className="twin-hud-overlay">
            <div className="hud-status-group">
              <span className="live-telemetry-badge">
                <span className="badge-live-pulse" />
                TELEMETRY SYNCHRONIZED
              </span>
              <span className="hud-laser-power">OPTICAL POWER: {opticalPowerWatts} W</span>
              <span className="hud-scan-speed">GALVO SPEED: {markSpeedMmS} mm/s</span>
            </div>

            <div className="hud-beam-controls">
              <button
                className={`btn-beam-toggle ${beamActive ? 'active' : ''}`}
                onClick={() => setBeamActive(!beamActive)}
                title="Toggle simulated laser beam emission"
              >
                <Zap size={14} />
                <span>{beamActive ? 'LASER ARMED' : 'LASER STANDBY'}</span>
              </button>
            </div>
          </div>

          {/* THE 2.5D HAN'S LASER PHYSICAL STATION */}
          <div className="laser-station-stage">
            {/* Ambient Optical Glow & Shadow */}
            <div className="laser-ambient-shadow" />

            {/* Han's Laser Machine Assembly */}
            <div className="hans-laser-assembly">
              {/* TOP MAST: Z-AXIS LIFT COLUMN WITH HANDWHEEL */}
              <div className="column-assembly">
                {/* Manual Height Handwheel on Top */}
                <div className="column-handwheel" title="Z-Axis Focus Height Adjustment Handwheel">
                  <div className="handwheel-knob" />
                  <div className="handwheel-rim" />
                </div>

                {/* Vertical Stainless Steel Column */}
                <div className="vertical-pillar">
                  <div className="pillar-metric-scale">
                    <span />
                    <span />
                    <span />
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
              </div>

              {/* HORIZONTAL CANTILEVER ARM & GALVO SCAN HEAD */}
              <div className="galvo-arm-assembly">
                {/* Horizontal Boom Arm */}
                <div className="boom-arm" />

                {/* Optical Galvo Scan Head Housing */}
                <div
                  className={`galvo-head-box ${isGalvoCritical ? 'galvo-crit' : isGalvoWarning ? 'galvo-warn' : ''}`}
                  onClick={() => setActiveSubsystem('galvo')}
                  title="Click to inspect Galvo Scanner"
                >
                  <div className="laser-warning-triangle" title="Class 4 Laser Radiation Warning">
                    ▲
                  </div>
                  <span className="galvo-head-title">GALVO SCANNER</span>

                  {/* Hotspot Pin 1: Galvo Motor Vibration */}
                  <div className="twin-hotspot hotspot-galvo">
                    <span className="hotspot-pulse" style={{ borderColor: subsystems.galvo.color }} />
                    <span className="hotspot-dot" style={{ backgroundColor: subsystems.galvo.color }} />
                    <div className="hotspot-tooltip">
                      <strong>Galvo Vibration</strong>
                      <span>{vibration.toFixed(2)} mm/s</span>
                    </div>
                  </div>

                  {/* F-Theta Telecentric Lens */}
                  <div className="ftheta-lens">
                    <div className="lens-glass" />
                  </div>
                </div>

                {/* EMITTED LASER BEAM (When Armed) */}
                {beamActive && (
                  <div className={`laser-beam-cone ${isLaserCritical ? 'beam-crit' : ''}`}>
                    <div className="laser-beam-core" />
                    <div className="laser-spark-focal" />
                  </div>
                )}
              </div>

              {/* OPERATOR PC MONITOR ON ARTICULATED SWIVEL ARM */}
              <div className="monitor-assembly">
                <div className="monitor-mount-arm" />
                <div className="monitor-screen">
                  <div className="monitor-screen-header">
                    <span className="screen-dot red" />
                    <span className="screen-dot yellow" />
                    <span className="screen-dot green" />
                    <span className="screen-app-title">EzCad3 / Han's Laser</span>
                  </div>
                  <div className="monitor-screen-body">
                    <div className="mini-marking-preview">
                      <span className="text-line">{activeWorkpieceData.title}</span>
                      <span className="param-line">Pwr: {activeWorkpieceData.powerSetting} | Spd: {activeWorkpieceData.speed}</span>
                      <span className="freq-line">Freq: {activeWorkpieceData.frequency} | Q: 200ns</span>
                    </div>
                    <div className="monitor-laser-pulse-bar" />
                  </div>
                </div>
              </div>

              {/* CONSOLE CONTROL BUTTON BAR */}
              <div className="console-button-bar">
                <div className="btn-estop" title="Emergency Stop Mushroom Button" />
                <div className="key-switch" title="Laser Power Interlock Key" />
                <div className="btn-start" title="Laser Marking Start" />
              </div>

              {/* WORKTABLE SURFACE & PLACED WORKPIECE */}
              <div className="worktable-surface">
                <div className="table-top-plate">
                  <div className="t-slots">
                    <span />
                    <span />
                    <span />
                    <span />
                  </div>

                  {/* WORKPIECE UNDER LASER LENS */}
                  <div className={`workpiece-placed workpiece-${selectedWorkpiece}`}>
                    {selectedWorkpiece === 'watch' && (
                      <div className="sample-watch-case">
                        <div className="watch-outer-bezel">
                          <span className="watch-text-top">3 ATM WATER RESISTANT</span>
                          <div className="watch-center-logo">
                            <strong>XOX</strong>
                            <em>Betsey</em>
                          </div>
                          <span className="watch-text-sub">BJ00358-02 • SR626SW</span>
                          <span className="watch-text-bottom">STAINLESS STEEL CASE BACK</span>
                        </div>
                        {beamActive && <div className="laser-engraving-spark" />}
                      </div>
                    )}

                    {selectedWorkpiece === 'automotive' && (
                      <div className="sample-automotive-part">
                        <div className="aluminum-texture">
                          <span className="part-cast-label">THROTTLE BODY A380</span>
                          <strong className="part-serial-engraved">HB99 28286663</strong>
                          <div className="part-datamatrix-box">
                            <span className="dm-grid" />
                          </div>
                        </div>
                        {beamActive && <div className="laser-engraving-spark" />}
                      </div>
                    )}

                    {selectedWorkpiece === 'eartag' && (
                      <div className="sample-eartag">
                        <div className="eartag-pin-hole" />
                        <div className="eartag-body">
                          <span className="tag-brand">UPLDB</span>
                          <div className="tag-barcode-lines">
                            <span /><span /><span /><span /><span /><span /><span /><span />
                          </div>
                          <strong className="tag-number">190073</strong>
                          <strong className="tag-number-large">041986</strong>
                        </div>
                        {beamActive && <div className="laser-engraving-spark" />}
                      </div>
                    )}

                    {selectedWorkpiece === 'pendant' && (
                      <div className="sample-brass-pendant">
                        <div className="pendant-loop" />
                        <div className="pendant-ring">
                          <span className="pendant-date">TEMA * 15.06.1977</span>
                          <div className="pendant-center-char">福</div>
                        </div>
                        {beamActive && <div className="laser-engraving-spark" />}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* MAIN BLUE CHASSIS CABINET (LOWER WORKSTATION) */}
              <div
                className="chassis-cabinet"
                onClick={() => setActiveSubsystem('laser_source')}
                title="Click to inspect internal Fiber Laser Module"
              >
                {/* Official Han's Laser Lettering Badge */}
                <div className="hans-branding-strip">
                  <span className="hans-logo-text">HAN'S LASER</span>
                </div>

                {/* Left Side Ventilation Louvers */}
                <div className="cabinet-louvers-left">
                  <span /><span /><span /><span /><span /><span /><span /><span />
                </div>

                {/* Front Access Service Door */}
                <div className="cabinet-front-door">
                  <div className="door-handle-lock">
                    <div className="keyhole" />
                  </div>

                  {/* Internal Laser Source Visualizer Window */}
                  <div
                    className={`internal-fiber-source ${isLaserCritical ? 'fiber-crit' : isLaserWarning ? 'fiber-warn' : 'fiber-nom'}`}
                  >
                    <div className="laser-diode-core">
                      <Flame size={24} className="fiber-core-icon" />
                      <span className="fiber-temp-label">{temp.toFixed(1)}°C</span>
                    </div>
                  </div>

                  <div className="door-louvers">
                    <span /><span /><span /><span />
                  </div>
                </div>

                {/* Right Side Power System Enclosure */}
                <div
                  className="cabinet-power-module"
                  onClick={(e) => {
                    e.stopPropagation()
                    setActiveSubsystem('power_system')
                  }}
                  title="Click to inspect DC Power System"
                >
                  <Zap size={14} className="power-zap-icon" />
                  <span className="power-rail-text">{voltage.toFixed(0)}V / {current.toFixed(1)}A</span>
                </div>

                {/* Hotspot Pin 2: Fiber Laser Core Temperature */}
                <div className="twin-hotspot hotspot-fiber">
                  <span className="hotspot-pulse" style={{ borderColor: subsystems.laser_source.color }} />
                  <span className="hotspot-dot" style={{ backgroundColor: subsystems.laser_source.color }} />
                  <div className="hotspot-tooltip">
                    <strong>Laser Module Temp</strong>
                    <span>{temp.toFixed(1)} °C</span>
                  </div>
                </div>

                {/* Hotspot Pin 3: Exhaust Negative Pressure */}
                <div
                  className="twin-hotspot hotspot-exhaust"
                  onClick={(e) => {
                    e.stopPropagation()
                    setActiveSubsystem('exhaust')
                  }}
                >
                  <span className="hotspot-pulse" style={{ borderColor: subsystems.exhaust.color }} />
                  <span className="hotspot-dot" style={{ backgroundColor: subsystems.exhaust.color }} />
                  <div className="hotspot-tooltip">
                    <strong>Exhaust Pressure</strong>
                    <span>{pressure.toFixed(1)} Bar</span>
                  </div>
                </div>

                {/* Heavy Duty Base Legs & Caster Wheels */}
                <div className="chassis-caster-wheels">
                  <div className="caster-wheel wheel-left" />
                  <div className="leveling-foot foot-left" />
                  <div className="leveling-foot foot-right" />
                  <div className="caster-wheel wheel-right" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: SUBSYSTEM DIAGNOSTICS & TELEMETRY BREAKDOWN */}
        <div className="twin-telemetry-column">
          {/* Subsystem Selector Tabs */}
          <div className="subsystem-tabs-bar">
            {Object.entries(subsystems).map(([key, sys]) => {
              const active = activeSubsystem === key
              return (
                <button
                  key={key}
                  className={`subsys-tab ${active ? 'active' : ''}`}
                  onClick={() => setActiveSubsystem(key)}
                  style={{ borderBottomColor: active ? sys.color : 'transparent' }}
                >
                  <span
                    className="status-dot-mini"
                    style={{ backgroundColor: sys.color }}
                  />
                  <span>{key.replace('_', ' ').toUpperCase()}</span>
                </button>
              )
            })}
          </div>

          {/* ACTIVE SUBSYSTEM DEEP-DIVE CARD */}
          <div className="subsystem-detail-card panel">
            <div className="subsys-header">
              <div>
                <span className="subsys-tag">ACTIVE SUBSYSTEM INSPECTOR</span>
                <h3 className="subsys-name">{currentSubsystem.name}</h3>
              </div>
              <span
                className="subsys-status-badge"
                style={{
                  backgroundColor: `${currentSubsystem.color}20`,
                  color: currentSubsystem.color,
                  borderColor: currentSubsystem.color,
                }}
              >
                {currentSubsystem.status}
              </span>
            </div>

            <p className="subsys-desc">{currentSubsystem.description}</p>

            <div className="subsys-metrics-box">
              <div className="metric-row">
                <span className="m-label">PRIMARY TELEMETRY:</span>
                <strong className="m-val" style={{ color: currentSubsystem.color }}>
                  {currentSubsystem.measured}
                </strong>
              </div>
              <div className="metric-row">
                <span className="m-label">NOMINAL SAFE BAND:</span>
                <span className="m-val">{currentSubsystem.normalRange}</span>
              </div>
              <div className="metric-row">
                <span className="m-label">SENSOR TRANSDUCER:</span>
                <span className="m-val">{currentSubsystem.sensor}</span>
              </div>
            </div>

            <div className="subsys-failure-box">
              <div className="failure-title">
                <AlertTriangle size={15} />
                <span>PHYSICAL DEGRADATION MECHANISM:</span>
              </div>
              <p className="failure-text">{currentSubsystem.failureMode}</p>
            </div>

            <div className="subsys-action-box">
              <div className="action-title">
                <ShieldCheck size={15} />
                <span>PRESCRIPTIVE RELIABILITY INTERVENTION:</span>
              </div>
              <p className="action-text">{currentSubsystem.action}</p>
            </div>
          </div>

          {/* REAL-WORLD APPLICATION GALLERY CARD */}
          <div className="application-specs-card panel">
            <div className="panel-header">
              <div>
                <p className="section-label">LASER ABLATION PARAMETERS</p>
                <h2>Current Material Job Specs</h2>
              </div>
              <Award size={20} className="panel-icon-accent" />
            </div>

            <div className="workpiece-spec-body">
              <strong className="wp-detail-name">{activeWorkpieceData.title}</strong>
              <p className="wp-detail-desc">{activeWorkpieceData.details}</p>

              <div className="laser-settings-grid">
                <div className="setting-box">
                  <span className="s-label">MATERIAL:</span>
                  <strong className="s-val">{activeWorkpieceData.material}</strong>
                </div>
                <div className="setting-box">
                  <span className="s-label">TECHNIQUE:</span>
                  <strong className="s-val">{activeWorkpieceData.technique}</strong>
                </div>
                <div className="setting-box">
                  <span className="s-label">LASER POWER:</span>
                  <strong className="s-val">{activeWorkpieceData.powerSetting}</strong>
                </div>
                <div className="setting-box">
                  <span className="s-label">PULSE FREQ:</span>
                  <strong className="s-val">{activeWorkpieceData.frequency}</strong>
                </div>
                <div className="setting-box">
                  <span className="s-label">MARK SPEED:</span>
                  <strong className="s-val">{activeWorkpieceData.speed}</strong>
                </div>
                <div className="setting-box">
                  <span className="s-label">FOCAL LENS:</span>
                  <strong className="s-val">F-Theta 160mm</strong>
                </div>
               </div>
             </div>
           </div>
         </div>
        </div>
      </>
      )}
    </div>
  )
}
