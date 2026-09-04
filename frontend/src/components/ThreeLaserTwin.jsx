import React, { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import {
  AlertTriangle,
  Award,
  Box,
  CheckCircle2,
  ChevronRight,
  Cpu,
  Crosshair,
  ExternalLink,
  Eye,
  Flame,
  Gauge,
  HelpCircle,
  Layers,
  Maximize2,
  Minimize2,
  Play,
  Radio,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Sparkles,
  Wrench,
  Zap,
} from 'lucide-react'

export function ThreeLaserTwin({
  machineName = "Han's Laser Fiber Marking Station",
  predictionState = 'NORMAL',
  healthScore = 96,
  telemetry = {},
  onOpenWorkOrder,
}) {
  const mountRef = useRef(null)
  const sceneRef = useRef(null)
  const rendererRef = useRef(null)
  const cameraRef = useRef(null)
  const controlsRef = useRef(null)
  const animationFrameRef = useRef(null)

  // 3D Animated Parts References
  const partsRef = useRef({
    cabinetDoor: null,
    laserModule: null,
    galvoCover: null,
    galvoBearings: null,
    powerSupply: null,
    exhaustManifold: null,
    laserBeam: null,
    laserFocalPoint: null,
    highlightBeacon: null,
  })

  // State
  const [explosionProgress, setExplosionProgress] = useState(0) // 0 to 1
  const [autoOpened, setAutoOpened] = useState(false)
  const [selectedSubsystem, setSelectedSubsystem] = useState(null)
  const [beamEnabled, setBeamEnabled] = useState(true)
  const [autoRotate, setAutoRotate] = useState(false)

  // Physical telemetry values
  const vibration = Number(telemetry.vibration) || 0.4
  const temp = Number(telemetry.motor_temperature) || 45.0
  const current = Number(telemetry.motor_current) || 3.8
  const voltage = Number(telemetry.motor_voltage) || 230.0
  const rpm = Number(telemetry.rpm) || 1450.0
  const pressure = Number(telemetry.pressure) || 4.8

  // Identify the Primary Root-Cause Faulted Subsystem
  const getRootCause = () => {
    if (vibration >= 1.2) {
      return {
        id: 'galvo_bearings',
        name: 'Galvo Scanner X/Y High-Speed Bearings',
        subsystem: 'Galvo Optical Scan Head',
        status: vibration >= 2.0 ? 'CRITICAL' : 'WARNING',
        color: vibration >= 2.0 ? '#ff3b45' : '#ffae42',
        telemetry: `${vibration.toFixed(2)} mm/s`,
        nominal: '0.10 - 0.75 mm/s',
        anomaly: 'Excessive mirror acceleration resonance & bearing spalling',
        shapImpact: '+0.64 (+82% fault probability)',
        action: 'Replace Galvo-X bearing cartridge & recalibrate optical zero with interferometer.',
        partNumber: 'SKF-6205-HYBRID-CERAMIC',
        location: 'Upper Cantilever Scan Head Assembly',
      }
    }
    if (temp >= 58.0) {
      return {
        id: 'laser_module',
        name: 'Fiber Laser Oscillator & Pump Diode Cavity',
        subsystem: 'Chassis Lower Compartment',
        status: temp >= 75.0 ? 'CRITICAL' : 'WARNING',
        color: temp >= 75.0 ? '#ff3b45' : '#ffae42',
        telemetry: `${temp.toFixed(1)} °C`,
        nominal: '25.0 - 55.0 °C',
        anomaly: 'Laser cavity thermal runaway & Bragg grating shift',
        shapImpact: '+0.58 (+76% fault probability)',
        action: 'Clear dust mesh filters, test internal forced-air fans, reduce diode duty cycle.',
        partNumber: 'MAX-PHOTONICS-FB-PUMP',
        location: 'Lower Chassis Drawer Rail',
      }
    }
    if (current >= 5.5 || voltage < 210) {
      return {
        id: 'power_supply',
        name: 'Industrial 24V DC Switch-Mode Power Supply',
        subsystem: 'Internal Cabinet Electronics Bay',
        status: 'WARNING',
        color: '#ffae42',
        telemetry: `${current.toFixed(1)} A / ${voltage.toFixed(0)} V`,
        nominal: '3.0 - 5.0 A / 220 - 240 V',
        anomaly: 'Phase voltage sag & secondary rail current surge',
        shapImpact: '+0.34 (+45% fault probability)',
        action: 'Audit main 230V bus terminals and replace DC output smoothing capacitor.',
        partNumber: 'MEANWELL-NDR-480-24',
        location: 'Lower Chassis Electronics Rack',
      }
    }
    if (pressure <= 3.0) {
      return {
        id: 'exhaust_manifold',
        name: 'Fume Extraction & Pneumatic Manifold',
        subsystem: 'Rear Cabinet Duct & Pneumatics',
        status: 'WARNING',
        color: '#ffae42',
        telemetry: `${pressure.toFixed(1)} Bar`,
        nominal: '3.5 - 6.0 Bar',
        anomaly: 'HEPA particulate saturation and exhaust restriction',
        shapImpact: '+0.29 (+38% fault probability)',
        action: 'Replace primary HEPA/carbon filter core and check vacuum hose clamp.',
        partNumber: 'HEPA-CARBON-DUO-500',
        location: 'Cabinet Base Manifold',
      }
    }

    return {
      id: 'healthy',
      name: 'All Subsystems Operating in Nominal Class-A Envelope',
      subsystem: 'Han\'s Laser Marking Station',
      status: 'HEALTHY',
      color: '#35d69a',
      telemetry: 'All sensors in safe band',
      nominal: 'Optimal parameter tolerances',
      anomaly: 'No active anomalous vibrations or thermal runaway detected.',
      shapImpact: 'Negative fault attribution (Baseline Nominal)',
      action: 'Continue continuous operational monitoring.',
      partNumber: 'N/A (All systems healthy)',
      location: 'Fully Assembled & Calibrated',
    }
  }

  const rootCause = getRootCause()
  const rootCauseRef = useRef(rootCause)

  // Target explosion value ref for smooth animation
  const targetExplosionRef = useRef(0)

  useEffect(() => {
    rootCauseRef.current = rootCause
  }, [rootCause])

  useEffect(() => {
    targetExplosionRef.current = explosionProgress
  }, [explosionProgress])

  // Three.js Scene Setup & LifeCycle
  useEffect(() => {
    const container = mountRef.current
    if (!container) return

    const width = container.clientWidth || 800
    const height = container.clientHeight || 540

    // 1. SCENE
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x060b14)
    scene.fog = new THREE.FogExp2(0x060b14, 0.035)
    sceneRef.current = scene

    // 2. CAMERA
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100)
    camera.position.set(4.5, 3.8, 6.0)
    cameraRef.current = camera

    // 3. RENDERER
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFShadowMap
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.2

    while (container.firstChild) {
      container.removeChild(container.firstChild)
    }
    container.appendChild(renderer.domElement)
    rendererRef.current = renderer

    // 4. CONTROLS
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.05
    controls.target.set(0, 1.3, 0)
    controls.maxPolarAngle = Math.PI / 2 + 0.05
    controls.minDistance = 2.0
    controls.maxDistance = 12.0
    controlsRef.current = controls

    // 5. LIGHTING
    const ambientLight = new THREE.AmbientLight(0xddeeff, 0.6)
    scene.add(ambientLight)

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.4)
    keyLight.position.set(5, 8, 5)
    keyLight.castShadow = true
    keyLight.shadow.mapSize.width = 1024
    keyLight.shadow.mapSize.height = 1024
    scene.add(keyLight)

    const blueFillLight = new THREE.DirectionalLight(0x31d7ff, 0.8)
    blueFillLight.position.set(-5, 4, -4)
    scene.add(blueFillLight)

    const rimLight = new THREE.DirectionalLight(0xff8844, 0.5)
    rimLight.position.set(0, -2, -5)
    scene.add(rimLight)

    // 6. CYBER GRID FLOOR
    const grid = new THREE.GridHelper(16, 32, 0x1e4b85, 0x0a1c36)
    grid.position.y = -0.01
    scene.add(grid)

    // Floor contact shadow disc
    const floorGeo = new THREE.CircleGeometry(4.0, 32)
    const floorMat = new THREE.MeshBasicMaterial({
      color: 0x02050b,
      transparent: true,
      opacity: 0.8,
    })
    const floorDisc = new THREE.Mesh(floorGeo, floorMat)
    floorDisc.rotation.x = -Math.PI / 2
    floorDisc.position.y = 0.001
    scene.add(floorDisc)

    // =========================================================
    // 7. BUILD 3D HAN'S LASER WORKSTATION ASSEMBLY
    // =========================================================
    const hansBlueMat = new THREE.MeshStandardMaterial({
      color: 0x16467e,
      roughness: 0.35,
      metalness: 0.45,
    })
    const darkChassisMat = new THREE.MeshStandardMaterial({
      color: 0x0b1524,
      roughness: 0.6,
      metalness: 0.5,
    })
    const steelMat = new THREE.MeshStandardMaterial({
      color: 0xc8d7e6,
      roughness: 0.2,
      metalness: 0.85,
    })
    const aluminumTableMat = new THREE.MeshStandardMaterial({
      color: 0x8a9db0,
      roughness: 0.3,
      metalness: 0.8,
    })
    const brassMat = new THREE.MeshStandardMaterial({
      color: 0xd4af37,
      roughness: 0.3,
      metalness: 0.9,
    })

    // Root Machine Group
    const machineGroup = new THREE.Group()
    scene.add(machineGroup)

    // A. CHASSIS BASE CABINET (Fixed)
    const cabinetBoxGeo = new THREE.BoxGeometry(1.6, 1.4, 1.2)
    const cabinetBase = new THREE.Mesh(cabinetBoxGeo, hansBlueMat)
    cabinetBase.position.set(0, 0.7, 0)
    cabinetBase.castShadow = true
    cabinetBase.receiveShadow = true
    machineGroup.add(cabinetBase)

    // Cabinet Louvers on Side
    for (let i = 0; i < 6; i++) {
      const louverGeo = new THREE.BoxGeometry(0.02, 0.03, 0.6)
      const louver = new THREE.Mesh(louverGeo, darkChassisMat)
      louver.position.set(-0.81, 0.4 + i * 0.1, 0)
      machineGroup.add(louver)
    }

    // 4 Caster Wheels
    const wheelGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.08, 16)
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.8 })
    const wheelPositions = [
      [-0.65, 0.08, -0.45],
      [0.65, 0.08, -0.45],
      [-0.65, 0.08, 0.45],
      [0.65, 0.08, 0.45],
    ]
    wheelPositions.forEach(([x, y, z]) => {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat)
      wheel.position.set(x, y, z)
      wheel.rotation.z = Math.PI / 2
      machineGroup.add(wheel)
    })

    // B. SWINGING FRONT CABINET DOOR (Mounted on Hinge Pivot!)
    // Pivot is located at the right edge (x = 0.8, z = 0.61)
    const doorPivot = new THREE.Group()
    doorPivot.position.set(0.79, 0.7, 0.61) // right hinge
    machineGroup.add(doorPivot)
    partsRef.current.cabinetDoor = doorPivot

    const doorGeo = new THREE.BoxGeometry(1.56, 1.34, 0.04)
    const doorMat = new THREE.MeshStandardMaterial({
      color: 0x1d5494,
      roughness: 0.35,
      metalness: 0.4,
    })
    const doorMesh = new THREE.Mesh(doorGeo, doorMat)
    doorMesh.position.set(-0.78, 0, 0) // offset from hinge so it swings naturally
    doorPivot.add(doorMesh)

    // Handle on door
    const handleGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.2, 8)
    const handle = new THREE.Mesh(handleGeo, steelMat)
    handle.position.set(-1.45, 0.1, 0.05)
    doorPivot.add(handle)

    // C. INTERNAL FIBER LASER MODULE (Inside cabinet, slides out when opened!)
    const laserModuleGroup = new THREE.Group()
    laserModuleGroup.position.set(-0.2, 0.7, 0)
    machineGroup.add(laserModuleGroup)
    partsRef.current.laserModule = laserModuleGroup

    // Laser Source Chassis
    const laserChassisGeo = new THREE.BoxGeometry(0.9, 0.45, 0.7)
    const laserChassisMat = new THREE.MeshStandardMaterial({
      color: 0x1a2638,
      roughness: 0.4,
      metalness: 0.6,
    })
    const laserChassis = new THREE.Mesh(laserChassisGeo, laserChassisMat)
    laserModuleGroup.add(laserChassis)

    // Laser Diode Heat Sink Fins
    for (let f = 0; f < 10; f++) {
      const finGeo = new THREE.BoxGeometry(0.85, 0.02, 0.65)
      const finMat = new THREE.MeshStandardMaterial({ color: 0x3d5069, metalness: 0.8 })
      const fin = new THREE.Mesh(finGeo, finMat)
      fin.position.set(0, 0.1 + f * 0.025, 0)
      laserModuleGroup.add(fin)
    }

    // Glowing Fiber Laser Diode Core Window
    const coreGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.08, 16)
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0xff3b45,
      emissive: 0xff2200,
      emissiveIntensity: 0.8,
    })
    const core = new THREE.Mesh(coreGeo, coreMat)
    core.rotation.x = Math.PI / 2
    core.position.set(0, 0, 0.36)
    laserModuleGroup.add(core)

    // D. INTERNAL DC POWER SUPPLY & RF DRIVER (Inside cabinet)
    const psuGroup = new THREE.Group()
    psuGroup.position.set(0.5, 0.5, 0)
    machineGroup.add(psuGroup)
    partsRef.current.powerSupply = psuGroup

    const psuGeo = new THREE.BoxGeometry(0.35, 0.5, 0.6)
    const psuMat = new THREE.MeshStandardMaterial({ color: 0x243242, metalness: 0.7 })
    const psu = new THREE.Mesh(psuGeo, psuMat)
    psuGroup.add(psu)

    // Capacitors on PSU
    for (let c = 0; c < 3; c++) {
      const capGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.15, 12)
      const capMat = new THREE.MeshStandardMaterial({ color: 0x31d7ff, metalness: 0.5 })
      const cap = new THREE.Mesh(capGeo, capMat)
      cap.position.set(0, 0.2, -0.15 + c * 0.15)
      psuGroup.add(cap)
    }

    // E. FUME EXTRACTION / PNEUMATICS MANIFOLD (Inside cabinet bottom)
    const exhaustGroup = new THREE.Group()
    exhaustGroup.position.set(0, 0.25, -0.2)
    machineGroup.add(exhaustGroup)
    partsRef.current.exhaustManifold = exhaustGroup

    const ductGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.6, 16)
    const ductMat = new THREE.MeshStandardMaterial({ color: 0x334455, metalness: 0.6 })
    const duct = new THREE.Mesh(ductGeo, ductMat)
    duct.rotation.z = Math.PI / 2
    exhaustGroup.add(duct)

    // F. WORKTABLE SURFACE PLATE (Top of cabinet)
    const tableGeo = new THREE.BoxGeometry(1.7, 0.08, 1.3)
    const table = new THREE.Mesh(tableGeo, aluminumTableMat)
    table.position.set(0, 1.44, 0)
    table.receiveShadow = true
    machineGroup.add(table)

    // Workpiece placed on table (Sample Watch Case / Disc)
    const workpieceGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.03, 32)
    const workpiece = new THREE.Mesh(workpieceGeo, brassMat)
    workpiece.position.set(-0.2, 1.5, 0.1)
    machineGroup.add(workpiece)

    // G. Z-AXIS LIFT COLUMN & HANDWHEEL
    const columnBase = new THREE.Group()
    columnBase.position.set(0.45, 1.48, -0.3)
    machineGroup.add(columnBase)

    const columnGeo = new THREE.CylinderGeometry(0.06, 0.06, 1.5, 20)
    const column = new THREE.Mesh(columnGeo, steelMat)
    column.position.set(0, 0.75, 0)
    columnBase.add(column)

    // Top Handwheel
    const handwheelRimGeo = new THREE.TorusGeometry(0.12, 0.02, 12, 24)
    const handwheel = new THREE.Mesh(handwheelRimGeo, darkChassisMat)
    handwheel.rotation.x = Math.PI / 2
    handwheel.position.set(0, 1.52, 0)
    columnBase.add(handwheel)

    // H. GALVO ARM & SCANNER HEAD (Mounted on Column)
    const galvoArmGroup = new THREE.Group()
    galvoArmGroup.position.set(0.45, 2.2, -0.3)
    machineGroup.add(galvoArmGroup)

    // Cantilever Horizontal Boom Arm
    const boomGeo = new THREE.BoxGeometry(0.7, 0.12, 0.14)
    const boom = new THREE.Mesh(boomGeo, steelMat)
    boom.position.set(-0.35, 0, 0.2)
    galvoArmGroup.add(boom)

    // GALVO SCAN HEAD HOUSING (at -0.65, 0, 0.4 relative to column)
    const scanHeadGroup = new THREE.Group()
    scanHeadGroup.position.set(-0.65, 0, 0.4)
    galvoArmGroup.add(scanHeadGroup)

    // Lower Scan Head Body
    const galvoBaseGeo = new THREE.BoxGeometry(0.36, 0.3, 0.36)
    const galvoBaseMat = new THREE.MeshStandardMaterial({
      color: 0x1b2838,
      roughness: 0.3,
      metalness: 0.7,
    })
    const galvoBase = new THREE.Mesh(galvoBaseGeo, galvoBaseMat)
    scanHeadGroup.add(galvoBase)

    // F-Theta Lens at bottom
    const lensGeo = new THREE.CylinderGeometry(0.1, 0.12, 0.08, 20)
    const lensMat = new THREE.MeshStandardMaterial({
      color: 0x0088cc,
      metalness: 0.9,
      roughness: 0.1,
    })
    const lens = new THREE.Mesh(lensGeo, lensMat)
    lens.position.set(0, -0.18, 0)
    scanHeadGroup.add(lens)

    // GALVO COVER (Lifts up during disassembly!)
    const galvoCoverGeo = new THREE.BoxGeometry(0.38, 0.08, 0.38)
    const galvoCoverMat = new THREE.MeshStandardMaterial({
      color: 0x22354c,
      roughness: 0.3,
      metalness: 0.6,
    })
    const galvoCover = new THREE.Mesh(galvoCoverGeo, galvoCoverMat)
    galvoCover.position.set(0, 0.18, 0)
    scanHeadGroup.add(galvoCover)
    partsRef.current.galvoCover = galvoCover

    // INTERNAL GALVO X/Y SCANNING MIRROR MOTORS & BEARINGS (Revealed when open!)
    const galvoBearingsGroup = new THREE.Group()
    galvoBearingsGroup.position.set(0, 0.05, 0)
    scanHeadGroup.add(galvoBearingsGroup)
    partsRef.current.galvoBearings = galvoBearingsGroup

    // X-Galvo Motor Cylinder
    const xMotorGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.16, 16)
    const bearingMat = new THREE.MeshStandardMaterial({
      color: 0x35d69a,
      emissive: 0x000000,
      metalness: 0.85,
    })
    const xMotor = new THREE.Mesh(xMotorGeo, bearingMat)
    xMotor.rotation.z = Math.PI / 2
    xMotor.position.set(0, 0.04, -0.06)
    galvoBearingsGroup.add(xMotor)

    // Y-Galvo Motor Cylinder
    const yMotor = new THREE.Mesh(xMotorGeo, bearingMat)
    yMotor.position.set(0.06, 0.04, 0.06)
    galvoBearingsGroup.add(yMotor)

    // Small Gold Mirrors on Galvos
    const mirrorGeo = new THREE.BoxGeometry(0.04, 0.05, 0.005)
    const mirror = new THREE.Mesh(mirrorGeo, brassMat)
    mirror.position.set(0, -0.05, 0)
    galvoBearingsGroup.add(mirror)

    // I. LASER EMISSION BEAM (Pulsing Red Cone to Workpiece)
    const beamGeo = new THREE.CylinderGeometry(0.008, 0.04, 0.7, 16)
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xff2233,
      transparent: true,
      opacity: 0.85,
    })
    const beam = new THREE.Mesh(beamGeo, beamMat)
    beam.position.set(0, -0.55, 0)
    scanHeadGroup.add(beam)
    partsRef.current.laserBeam = beam

    // Focal Spark Point on Workpiece
    const sparkGeo = new THREE.SphereGeometry(0.03, 12, 12)
    const sparkMat = new THREE.MeshBasicMaterial({ color: 0xffffff })
    const spark = new THREE.Mesh(sparkGeo, sparkMat)
    spark.position.set(0, -0.9, 0)
    scanHeadGroup.add(spark)
    partsRef.current.laserFocalPoint = spark

    // J. 3D HIGHLIGHT BEACON & TARGET RING (Hovers over Problem Area)
    const beaconGroup = new THREE.Group()
    scene.add(beaconGroup)
    partsRef.current.highlightBeacon = beaconGroup

    const ringGeo = new THREE.RingGeometry(0.12, 0.16, 24)
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xff3b45,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
    })
    const ring = new THREE.Mesh(ringGeo, ringMat)
    ring.rotation.x = Math.PI / 2
    beaconGroup.add(ring)

    const beaconCylinderGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.4, 8)
    const beaconCylinder = new THREE.Mesh(beaconCylinderGeo, ringMat)
    beaconCylinder.position.set(0, 0.2, 0)
    beaconGroup.add(beaconCylinder)

    // K. OPERATOR PC MONITOR (Mounted on arm)
    const monitorArm = new THREE.Group()
    monitorArm.position.set(0.65, 1.48, 0.3)
    machineGroup.add(monitorArm)

    const monArmGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.7, 8)
    const monArm = new THREE.Mesh(monArmGeo, steelMat)
    monArm.position.set(0, 0.35, 0)
    monitorArm.add(monArm)

    const monScreenGeo = new THREE.BoxGeometry(0.45, 0.3, 0.04)
    const monScreen = new THREE.Mesh(monScreenGeo, darkChassisMat)
    monScreen.position.set(0, 0.7, 0)
    monScreen.rotation.y = -Math.PI / 6
    monitorArm.add(monScreen)

    // 8. RESIZE HANDLER
    const handleResize = () => {
      if (!container || !renderer || !camera) return
      const w = container.clientWidth
      const h = container.clientHeight
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    window.addEventListener('resize', handleResize)

    // 9. ANIMATION TICK LOOP
    let clock = new THREE.Clock()
    let currentDoorAngle = 0
    let currentLaserSlide = 0
    let currentGalvoLift = 0

    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate)

      const delta = clock.getDelta()
      const time = clock.getElapsedTime()

      // Smooth Lerp for Disassembly / Opening
      const exp = targetExplosionRef.current

      // Door rotation: 0 to ~95 degrees (1.65 rad)
      const targetDoorAngle = exp * 1.65
      currentDoorAngle += (targetDoorAngle - currentDoorAngle) * 0.08
      if (partsRef.current.cabinetDoor) {
        partsRef.current.cabinetDoor.rotation.y = currentDoorAngle
      }

      // Laser module slides out of cabinet forward: 0 to 0.7 units along Z
      const targetLaserSlide = exp * 0.7
      currentLaserSlide += (targetLaserSlide - currentLaserSlide) * 0.08
      if (partsRef.current.laserModule) {
        partsRef.current.laserModule.position.z = currentLaserSlide
      }

      // Galvo cover lifts upward: 0 to 0.4 units along Y
      const targetGalvoLift = exp * 0.4
      currentGalvoLift += (targetGalvoLift - currentGalvoLift) * 0.08
      if (partsRef.current.galvoCover) {
        partsRef.current.galvoCover.position.y = 0.18 + currentGalvoLift
      }

      // Laser beam pulsing
      if (partsRef.current.laserBeam && partsRef.current.laserFocalPoint) {
        const pulse = 0.8 + Math.sin(time * 15) * 0.2
        partsRef.current.laserBeam.scale.set(pulse, 1, pulse)
        partsRef.current.laserFocalPoint.scale.set(pulse * 1.2, pulse * 1.2, pulse * 1.2)
      }

      // Root Cause Pulsing Highlighting
      const activeFault = rootCauseRef.current ? rootCauseRef.current.id : 'healthy'
      const pulseGlow = Math.sin(time * 6) * 0.5 + 0.5 // 0 to 1

      if (partsRef.current.galvoBearings) {
        partsRef.current.galvoBearings.traverse((child) => {
          if (child.isMesh && child.material) {
            if (activeFault === 'galvo_bearings') {
              child.material.emissive = new THREE.Color(0xff2200)
              child.material.emissiveIntensity = 0.4 + pulseGlow * 1.2
            } else {
              child.material.emissive = new THREE.Color(0x000000)
              child.material.emissiveIntensity = 0
            }
          }
        })
      }

      if (partsRef.current.laserModule) {
        partsRef.current.laserModule.traverse((child) => {
          if (child.isMesh && child.material) {
            if (activeFault === 'laser_module') {
              child.material.emissive = new THREE.Color(0xff3300)
              child.material.emissiveIntensity = 0.4 + pulseGlow * 1.2
            } else {
              child.material.emissive = new THREE.Color(0x000000)
              child.material.emissiveIntensity = 0
            }
          }
        })
      }

      // Update 3D Beacon Location
      if (partsRef.current.highlightBeacon) {
        if (activeFault === 'galvo_bearings') {
          partsRef.current.highlightBeacon.visible = true
          partsRef.current.highlightBeacon.position.set(-0.2, 2.45 + currentGalvoLift, 0.1)
          partsRef.current.highlightBeacon.scale.set(
            1 + pulseGlow * 0.3,
            1,
            1 + pulseGlow * 0.3
          )
        } else if (activeFault === 'laser_module') {
          partsRef.current.highlightBeacon.visible = true
          partsRef.current.highlightBeacon.position.set(-0.2, 1.1, currentLaserSlide + 0.3)
          partsRef.current.highlightBeacon.scale.set(
            1 + pulseGlow * 0.3,
            1,
            1 + pulseGlow * 0.3
          )
        } else {
          partsRef.current.highlightBeacon.visible = false
        }
      }

      controls.update()
      renderer.render(scene, camera)
    }

    animate()

    // CLEANUP
    return () => {
      window.removeEventListener('resize', handleResize)
      cancelAnimationFrame(animationFrameRef.current)
      controls.dispose()
      if (renderer.domElement && renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement)
      }
      renderer.dispose()
    }
  }, [])

  // Beam toggle handler
  useEffect(() => {
    if (partsRef.current.laserBeam) {
      partsRef.current.laserBeam.visible = beamEnabled
    }
    if (partsRef.current.laserFocalPoint) {
      partsRef.current.laserFocalPoint.visible = beamEnabled
    }
  }, [beamEnabled])

  // Auto-Open Trigger: Smoothly animate machine open when user requests or on fault
  const handleAutoOpenInspect = () => {
    if (explosionProgress < 0.8) {
      setExplosionProgress(1.0)
      setAutoOpened(true)

      // Smoothly focus camera on faulted area
      if (controlsRef.current && cameraRef.current) {
        if (rootCause.id === 'galvo_bearings') {
          controlsRef.current.target.set(-0.2, 2.2, 0.1)
          cameraRef.current.position.set(0.8, 2.7, 1.8)
        } else if (rootCause.id === 'laser_module') {
          controlsRef.current.target.set(-0.2, 0.8, 0.4)
          cameraRef.current.position.set(0.6, 1.4, 2.4)
        }
      }
    } else {
      setExplosionProgress(0)
      setAutoOpened(false)
      // Reset camera
      if (controlsRef.current && cameraRef.current) {
        controlsRef.current.target.set(0, 1.3, 0)
        cameraRef.current.position.set(4.5, 3.8, 6.0)
      }
    }
  }

  const handleResetCamera = () => {
    if (controlsRef.current && cameraRef.current) {
      controlsRef.current.target.set(0, 1.3, 0)
      cameraRef.current.position.set(4.5, 3.8, 6.0)
      setExplosionProgress(0)
      setAutoOpened(false)
    }
  }

  return (
    <div className="three-laser-twin-card panel">
      {/* 3D Viewport Header & Action Ribbon */}
      <div className="three-hud-header">
        <div className="hud-left-meta">
          <div className="three-d-badge">
            <span className="live-gl-dot" />
            <span>WebGL 3D Interactive Twin</span>
          </div>
          <span className="asset-code-title">HAN'S LASER • FIBER MARKING STATION</span>
        </div>

        <div className="hud-controls-ribbon">
          {/* 1-CLICK AUTO-OPEN & INSPECT ROOT CAUSE BUTTON */}
          <button
            className={`btn-auto-open ${autoOpened || explosionProgress > 0.5 ? 'active-open' : ''} ${rootCause.status === 'CRITICAL' ? 'crit-alert' : ''}`}
            onClick={handleAutoOpenInspect}
            title="Auto-open physical cabinet & focus on root-cause failure component"
          >
            <Layers size={15} />
            <span>
              {explosionProgress > 0.5 ? 'CLOSE MACHINE SHELL' : 'AUTO-OPEN & PINPOINT ROOT CAUSE'}
            </span>
          </button>

          {/* Laser Beam Toggle */}
          <button
            className={`btn-hud-icon ${beamEnabled ? 'beam-on' : ''}`}
            onClick={() => setBeamEnabled(!beamEnabled)}
            title="Toggle Laser Beam Emission"
          >
            <Zap size={14} />
            <span>{beamEnabled ? 'BEAM ON' : 'STANDBY'}</span>
          </button>

          {/* Reset Camera View */}
          <button
            className="btn-hud-icon"
            onClick={handleResetCamera}
            title="Reset 3D Orbit Camera"
          >
            <RotateCcw size={14} />
            <span>RESET CAM</span>
          </button>
        </div>
      </div>

      {/* DISASSEMBLY / EXPLODED-VIEW SLIDER BAR */}
      <div className="disassembly-slider-bar">
        <div className="slider-label-group">
          <Sliders size={14} className="text-cyan" />
          <span>PHYSICAL HOUSING DISASSEMBLY / EXPLODED CUTAWAY:</span>
          <strong>{Math.round(explosionProgress * 100)}% OPEN</strong>
        </div>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={explosionProgress}
          onChange={(e) => {
            setExplosionProgress(parseFloat(e.target.value))
            if (parseFloat(e.target.value) > 0.3) setAutoOpened(true)
            else setAutoOpened(false)
          }}
          className="disassembly-range-input"
        />
        <div className="slider-notches">
          <span>0% CLOSED (Operational)</span>
          <span>50% SERVICE CUTAWAY</span>
          <span>100% FULL EXPLODED VIEW</span>
        </div>
      </div>

      {/* MAIN 3D CANVAS VIEWPORT */}
      <div className="three-canvas-container">
        {/* Isolated WebGL Mount (No React child components inside) */}
        <div ref={mountRef} className="three-webgl-mount" />

        {/* Loading / Instructions hint overlay */}
        <div className="three-canvas-instructions">
          <small>Left Click + Drag: Rotate 360° • Scroll: Zoom In/Out • Right Click: Pan</small>
        </div>

        {/* ROOT CAUSE FLOATING 3D CALLOUT HUD */}
        {rootCause.id !== 'healthy' && (
          <div
            className={`root-cause-hud-callout ${rootCause.status === 'CRITICAL' ? 'crit' : 'warn'}`}
          >
            <div className="callout-header">
              <div className="callout-badge">
                <AlertTriangle size={15} />
                <span>ROOT-CAUSE COMPONENT PINPOINTED</span>
              </div>
              <span className="callout-status">{rootCause.status}</span>
            </div>

            <h4 className="callout-part-title">{rootCause.name}</h4>
            <span className="callout-loc">{rootCause.location}</span>

            <div className="callout-data-grid">
              <div className="c-item">
                <span className="c-lbl">LIVE TELEMETRY:</span>
                <strong className="c-val text-red">{rootCause.telemetry}</strong>
              </div>
              <div className="c-item">
                <span className="c-lbl">SAFE TOLERANCE:</span>
                <span className="c-val">{rootCause.nominal}</span>
              </div>
              <div className="c-item">
                <span className="c-lbl">AI ATTRIBUTION:</span>
                <span className="c-val text-amber">{rootCause.shapImpact}</span>
              </div>
              <div className="c-item">
                <span className="c-lbl">PART REPLACEMENT:</span>
                <span className="c-val text-cyan">{rootCause.partNumber}</span>
              </div>
            </div>

            <div className="callout-anomaly-text">
              <strong>PHYSICAL FAULT MECHANISM:</strong>
              <p>{rootCause.anomaly}</p>
            </div>

            <div className="callout-action-box">
              <strong>PRESCRIPTIVE INTERVENTION:</strong>
              <p>{rootCause.action}</p>
            </div>

            {onOpenWorkOrder && (
              <button
                className="btn-dispatch-workorder"
                onClick={() => onOpenWorkOrder(rootCause)}
              >
                <Wrench size={14} />
                <span>DISPATCH WORK ORDER FOR THIS COMPONENT</span>
                <ChevronRight size={14} />
              </button>
            )}
          </div>
        )}

        {/* HEALTHY CALLOUT IF NOMINAL */}
        {rootCause.id === 'healthy' && (
          <div className="root-cause-hud-callout healthy">
            <div className="callout-header">
              <div className="callout-badge">
                <CheckCircle2 size={15} className="text-green" />
                <span>ALL SUBSYSTEMS NOMINAL</span>
              </div>
              <span className="callout-status-green">100% INTEGRITY</span>
            </div>
            <h4 className="callout-part-title">{rootCause.name}</h4>
            <p className="callout-sub-text">
              Vibration (0.4 mm/s), Stator Temp (45°C), and Line Pressure (4.8 Bar) are safely within
              nominal Class-A tolerances.
            </p>
            <small className="callout-tip">
              Tip: In the Quick Scenarios bar above, click <strong>"2. Incipient Bearing Degradation"</strong> or{' '}
              <strong>"3. Thermal Runaway"</strong> to watch the 3D machine automatically open and highlight the fault!
            </small>
          </div>
        )}
      </div>
    </div>
  )
}
