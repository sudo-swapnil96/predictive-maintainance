import React, { useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Printer,
  ShieldAlert,
  ShieldCheck,
  Wrench,
  Zap,
} from 'lucide-react'

export function WorkOrders({
  machineId,
  machineName = 'Phase3 Test Machine',
  predictionState = 'NORMAL',
  alerts = [],
  prediction = null,
}) {
  const [lotoSteps, setLotoSteps] = useState({
    step1: false,
    step2: false,
    step3: false,
    step4: false,
    step5: false,
  })

  const [orderStatus, setOrderStatus] = useState('DISPATCHED')

  const toggleStep = (step) => {
    setLotoSteps((prev) => ({ ...prev, [step]: !prev[step] }))
  }

  const allLotoCompleted = Object.values(lotoSteps).every(Boolean)

  const handlePrint = () => {
    window.print()
  }

  // Derive root cause from SHAP
  const xai = prediction?.explanation?.xai || {}
  const topContributors = Array.isArray(xai.top_contributors) ? xai.top_contributors : []
  const primaryFactor = topContributors[0]?.feature || 'vibration'

  const partsCatalog = {
    vibration: [
      { partNo: 'SKF-6205-2RSH/C3', name: 'Deep Groove Radial Ball Bearing (Drive End)', qty: 1, cost: '$48.50' },
      { partNo: 'KLUBER-BEM-41', name: 'High-Temperature Synthetic Polyurea Grease (400g)', qty: 1, cost: '$32.00' },
      { partNo: 'FLEX-COUP-95A', name: 'Polyurethane Elastomeric Flexible Coupling Spider', qty: 1, cost: '$18.00' },
    ],
    motor_temperature: [
      { partNo: 'COOL-FAN-180M', name: 'Reinforced Thermoplastic Motor Cooling Impeller', qty: 1, cost: '$55.00' },
      { partNo: 'PT100-RTD-3W', name: 'Class-A 3-Wire Stator Winding Temperature RTD', qty: 2, cost: '$74.00' },
      { partNo: 'AERO-SHELL-7', name: 'High-Thermal Dissipation Motor Bearing Lubricant', qty: 1, cost: '$28.00' },
    ],
    motor_current: [
      { partNo: 'LUG-M8-50MM', name: 'Tinned Copper Heavy-Duty Terminal Cable Lugs', qty: 6, cost: '$24.00' },
      { partNo: 'FUSE-63A-GL', name: 'Ultra-Rapid Semiconductor Protection Fuse 63A', qty: 3, cost: '$68.00' },
    ],
    pressure: [
      { partNo: 'SEAL-VITON-45', name: 'Fluorocarbon Viton High-Pressure Hydraulic Shaft Seal', qty: 2, cost: '$36.00' },
      { partNo: 'VALVE-PR-06B', name: 'Direct-Acting Proportional Pressure Relief Valve', qty: 1, cost: '$120.00' },
    ],
  }

  const prescribedParts = partsCatalog[primaryFactor] || partsCatalog.vibration

  const toolList = [
    'Fluke 376 FC True-RMS AC/DC Clamp Meter & Multimeter',
    'SKF TKSA 41 High-Precision Laser Shaft Alignment System',
    'FLIR E8-XT Industrial High-Resolution Infrared Thermal Camera',
    'Calibrated Dual-Scale Click Torque Wrench (20 - 150 Nm)',
    'Hydraulic 3-Jaw Mechanical Bearing Extraction Puller',
  ]

  const isUrgent = predictionState === 'FAULT'
  const workOrderId = `WO-2026-IND-${machineId.slice(0, 8).toUpperCase()}`

  return (
    <div className="work-orders-page page-content">
      {/* Header Banner */}
      <div className="work-order-topbar no-print">
        <div>
          <p className="section-label">PRESCRIPTIVE MAINTENANCE DISPATCH</p>
          <h2>Automated Maintenance Work Order</h2>
          <p className="page-description">
            Generated automatically by the AI Prognostics & Diagnostics Engine based on real-time
            anomaly detection and SHAP root-cause contributions.
          </p>
        </div>

        <div className="work-order-actions">
          <button className="btn-print-workorder" onClick={handlePrint}>
            <Printer size={16} />
            <span>PRINT / SAVE REPORT</span>
          </button>
        </div>
      </div>

      {/* Formal Printable Work Order Sheet */}
      <div className="work-order-sheet">
        {/* Document Header */}
        <div className="sheet-header">
          <div className="company-branding">
            <div className="brand-badge-square">
              <Wrench size={26} />
            </div>
            <div>
              <strong className="company-title">INDUSTRIAL PREDICTIVE MAINTENANCE PLATFORM</strong>
              <p className="company-subtitle">Field Engineering & Autonomous Asset Reliability Dispatch</p>
            </div>
          </div>

          <div className="sheet-meta-box">
            <span className="sheet-meta-label">WORK ORDER NO:</span>
            <strong className="sheet-meta-id">{workOrderId}</strong>
            <span className="sheet-meta-date">Date: {new Date().toLocaleDateString()}</span>
          </div>
        </div>

        <div className="sheet-status-ribbon">
          <div className="ribbon-item">
            <span>TARGET ASSET:</span>
            <strong>{machineName}</strong>
          </div>
          <div className="ribbon-item">
            <span>SYSTEM STATE:</span>
            <strong className={`ribbon-val val-${predictionState.toLowerCase()}`}>
              {predictionState}
            </strong>
          </div>
          <div className="ribbon-item">
            <span>DISPATCH PRIORITY:</span>
            <strong className={`ribbon-priority ${isUrgent ? 'pri-urgent' : 'pri-scheduled'}`}>
              {isUrgent ? 'CRITICAL - IMMEDIATE LOTO' : 'PREVENTATIVE SCHEDULED'}
            </strong>
          </div>
          <div className="ribbon-item">
            <span>DISPATCH STATUS:</span>
            <strong className="ribbon-status">
              {allLotoCompleted ? 'LOTO VERIFIED - READY' : orderStatus}
            </strong>
          </div>
        </div>

        {/* SECTION 1: ROOT CAUSE DIAGNOSIS */}
        <div className="sheet-section">
          <div className="sheet-section-title">
            <AlertTriangle size={18} />
            <h3>1. Machine Diagnosis & SHAP Root-Cause Attribution</h3>
          </div>
          <p className="sheet-paragraph">
            The machine was classified in <strong>{predictionState}</strong> condition by the XGBoost multi-class
            model. Shapley Additive Explanations (SHAP) identified{' '}
            <strong>{primaryFactor.replace('_', ' ').toUpperCase()}</strong> as the primary physical parameter
            driving the fault probability index.
          </p>

          <div className="fault-attribution-summary">
            <div className="attr-item">
              <span className="attr-label">PRIMARY SYMPTOM:</span>
              <strong className="attr-val">
                {primaryFactor === 'vibration'
                  ? 'Bearing Race Micro-Spall & Dynamic Unbalance'
                  : primaryFactor === 'motor_temperature'
                  ? 'Stator Winding Overheating & Thermal Breakdown'
                  : primaryFactor === 'motor_current'
                  ? 'Electrical Phase Load Asymmetry'
                  : 'Pressure Delivery Cavitation'}
              </strong>
            </div>
            <div className="attr-item">
              <span className="attr-label">RECOMMENDED INTERVENTION:</span>
              <strong className="attr-val">
                {primaryFactor === 'vibration'
                  ? 'Inspect drive-end bearing, replace bearing assembly, dynamic balancing'
                  : primaryFactor === 'motor_temperature'
                  ? 'Clean stator cooling ducts, verify RTD integrity, flush lubricant'
                  : primaryFactor === 'motor_current'
                  ? 'Phase impedance test, inspect main terminal lugs'
                  : 'Inspect hydraulic proportional relief valve and seal pack'}
              </strong>
            </div>
          </div>
        </div>

        {/* SECTION 2: REQUIRED REPLACEMENT PARTS */}
        <div className="sheet-section">
          <div className="sheet-section-title">
            <Wrench size={18} />
            <h3>2. Prescribed Replacement Parts & Consumables</h3>
          </div>

          <table className="sheet-table">
            <thead>
              <tr>
                <th>PART NUMBER</th>
                <th>DESCRIPTION / SPECIFICATION</th>
                <th>QTY</th>
                <th>EST. COST</th>
              </tr>
            </thead>
            <tbody>
              {prescribedParts.map((part) => (
                <tr key={part.partNo}>
                  <td><code>{part.partNo}</code></td>
                  <td>{part.name}</td>
                  <td>{part.qty}</td>
                  <td>{part.cost}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* SECTION 3: CALIBRATED TOOLS */}
        <div className="sheet-section">
          <div className="sheet-section-title">
            <Zap size={18} />
            <h3>3. Required Engineering Instruments & Calibration Tools</h3>
          </div>
          <ul className="tools-checklist">
            {toolList.map((tool, idx) => (
              <li key={idx}>
                <CheckCircle2 size={16} className="tool-check-icon" />
                <span>{tool}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* SECTION 4: OSHA LOCKOUT/TAGOUT (LOTO) PROTOCOL */}
        <div className="sheet-section">
          <div className="sheet-section-title">
            <ShieldAlert size={18} />
            <h3>4. Mandatory OSHA Lockout/Tagout (LOTO) Safety Checklist</h3>
          </div>
          <p className="sheet-paragraph">
            Technician must complete and verify every safety isolation step prior to mechanical disassembly:
          </p>

          <div className="loto-checklist-box">
            {[
              { id: 'step1', text: 'Disconnect main 400V 3-phase circuit breaker and padlock handle with Safety Lock #LOTO-14.' },
              { id: 'step2', text: 'Test all terminals with calibrated multimeter to verify zero electrical energy state.' },
              { id: 'step3', text: 'Allow machine motor casing to cool below 40°C before touching rotating elements.' },
              { id: 'step4', text: 'Depressurize all hydraulic and pneumatic lines to 0 Bar and vent residual pressure.' },
              { id: 'step5', text: 'Apply mechanical shaft lock to prevent accidental freewheeling or kinetic recoil.' },
            ].map((step) => (
              <label
                key={step.id}
                className={`loto-step-row ${lotoSteps[step.id] ? 'step-verified' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={lotoSteps[step.id]}
                  onChange={() => toggleStep(step.id)}
                  className="loto-checkbox"
                />
                <span className="loto-text">{step.text}</span>
                {lotoSteps[step.id] && <span className="verified-tag">VERIFIED</span>}
              </label>
            ))}
          </div>
        </div>

        {/* SIGN-OFF SIGNATURE BLOCK */}
        <div className="sheet-signatures">
          <div className="sig-box">
            <span className="sig-label">AUTHORIZED ENGINEER:</span>
            <div className="sig-line" />
            <span className="sig-meta">Signature / License No.</span>
          </div>
          <div className="sig-box">
            <span className="sig-label">SAFETY OFFICER VERIFICATION:</span>
            <div className="sig-line" />
            <span className="sig-meta">OSHA LOTO Sign-off</span>
          </div>
          <div className="sig-box">
            <span className="sig-label">COMPLETION TIMESTAMP:</span>
            <div className="sig-line" />
            <span className="sig-meta">Date & Time Return to Service</span>
          </div>
        </div>
      </div>
    </div>
  )
}
