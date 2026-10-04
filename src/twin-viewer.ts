import {
  AmbientLight,
  Box3,
  BoxGeometry,
  CatmullRomCurve3,
  Color,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  GridHelper,
  Group,
  HemisphereLight,
  Light,
  Material,
  Mesh,
  MeshStandardMaterial,
  type Object3D,
  PerspectiveCamera,
  Raycaster,
  Scene,
  SphereGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'

import { avionicsChange, busDemandKw, capacityKw } from './twin'

type Focus = 'Airframe' | 'Aft bay' | 'Cockpit'
type Overlay = 'Shaded' | 'Thermal'
type Revision = 'A' | 'B'
type Condition = 'Normal' | 'Module failed'

type Preset = Readonly<{ position: Vector3; target: Vector3 }>

const presets: Readonly<Record<'Airframe' | 'Aft bay', Preset>> = {
  Airframe: {
    position: new Vector3(4.4, 2.6, 5.6),
    target: new Vector3(0, 0, 0.1),
  },
  'Aft bay': {
    position: new Vector3(1.75, 1.15, 3.05),
    target: new Vector3(0, 0.02, 1.32),
  },
}

const specs: Readonly<
  Record<
    Revision,
    Readonly<{ modules: number; mounts: number; plates: number }>
  >
> = {
  A: { modules: avionicsChange.modules.A, mounts: 4, plates: 1 },
  B: { modules: avionicsChange.modules.B, mounts: 6, plates: 2 },
}

const moduleWidth = 0.062
const moduleGap = 0.01
const rackDepth = 0.32
const rackHeight = 0.12
const rackWidth = (count: number): number =>
  count * (moduleWidth + moduleGap) + moduleGap
const slotX = (index: number, count: number): number =>
  -rackWidth(count) / 2 +
  moduleGap +
  moduleWidth / 2 +
  index * (moduleWidth + moduleGap)

const failedCount = (condition: Condition): number =>
  condition === 'Module failed' ? 1 : 0
const utilization = (
  revision: Revision,
  condition: Condition,
  demand: number,
): number => demand / capacityKw(revision, failedCount(condition))
const moduleTemperature = (load: number): number => 50 + 35 * load

const green = new Color('#16a34a')
const amber = new Color('#d97706')
const red = new Color('#dc2626')

const powerColor = (
  revision: Revision,
  condition: Condition,
  demand: number,
): Color =>
  utilization(revision, condition, demand) > 1
    ? red
    : demand > capacityKw(revision, 1)
      ? amber
      : green

const overlayMaterial = (color: Color | string): MeshStandardMaterial =>
  new MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.5,
    depthTest: false,
    transparent: true,
    opacity: 0.95,
  })

const psuCenter = new Vector3(0, 0.02, 1.32)
const cobalt = new Color('#1f4fd1')

const ramp = (temperature: number): Color => {
  const t = Math.min(1, Math.max(0, (temperature - 40) / 55))
  return new Color().setHSL(0.62 * (1 - t), 0.9, 0.5)
}

const loadAirframe = (): Promise<Group> =>
  new MTLLoader()
    .setPath('/models/')
    .loadAsync('f35-base.mtl')
    .then(materials => {
      materials.preload()
      return new OBJLoader()
        .setMaterials(materials)
        .setPath('/models/')
        .loadAsync('f35-base.obj')
    })

const paint: Readonly<Record<string, string>> = {
  f35_body: '#6b7380',
  f35_frame: '#59616c',
  f35_weapons_bay: '#a3abb5',
  engine: '#4b5563',
  glass: '#c9a64a',
  landing_gear01: '#c3c8ce',
  landing_gera02: '#c3c8ce',
  tire: '#1f2328',
  wheel: '#9aa3ad',
}

const restyle = (material: Material): Material =>
  new MeshStandardMaterial({
    name: material.name,
    color: paint[material.name] ?? '#8a929c',
    metalness: material.name === 'glass' ? 0.6 : 0.25,
    roughness: material.name === 'glass' ? 0.15 : 0.6,
    side: DoubleSide,
  })

const toMaterials = (value: unknown): ReadonlyArray<Material> =>
  Array.isArray(value)
    ? value.filter((item): item is Material => item instanceof Material)
    : value instanceof Material
      ? [value]
      : []

const materialsOf = (object: Object3D): ReadonlyArray<Material> => {
  const found: Array<Material> = []
  object.traverse(child => {
    found.push(...toMaterials(Reflect.get(child, 'material')))
  })
  return found
}

const easeInOut = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2

export class StreamTwin extends HTMLElement {
  #focus: Focus = 'Airframe'
  #overlay: Overlay = 'Thermal'
  #revision: Revision = 'A'
  #renderer: WebGLRenderer | undefined
  #scene = new Scene()
  #camera = new PerspectiveCamera(38, 1, 0.05, 100)
  #controls: OrbitControls | undefined
  #airframe: Group | undefined
  #psu = new Group()
  #condition: Condition = 'Module failed'
  #upgraded = false
  #dropPending = false
  #dropStart: number | undefined
  #rack = new Group()
  #modules: Array<Mesh<BoxGeometry, MeshStandardMaterial>> = []
  #slideStart: number | undefined
  #slidePending = false
  #cockpitPosition = new Vector3(0, 0.2, -1.3)
  #cockpit = new Mesh(
    new BoxGeometry(0.16, 0.08, 0.14),
    overlayMaterial('#f59e0b'),
  )
  #feeder: Mesh<TubeGeometry, MeshStandardMaterial> | undefined
  #curve: CatmullRomCurve3 | undefined
  #pulses: Array<Mesh<SphereGeometry, MeshStandardMaterial>> = []
  #cockpitLabel: HTMLDivElement | undefined
  #fixtures = new Group()
  #frame = 0
  #observer: ResizeObserver | undefined
  #flight:
    | Readonly<{
        fromOffset: Vector3
        toOffset: Vector3
        fromTarget: Vector3
        toTarget: Vector3
        start: number | undefined
      }>
    | undefined
  #label: HTMLDivElement | undefined
  #status: HTMLDivElement | undefined
  #down = new Vector2()

  set twinFocus(value: unknown) {
    if (
      (value === 'Airframe' || value === 'Aft bay' || value === 'Cockpit') &&
      value !== this.#focus
    ) {
      this.#focus = value
      this.#fly()
      this.#applyFocus()
    }
  }
  get twinFocus(): Focus {
    return this.#focus
  }
  set twinRevision(value: unknown) {
    if ((value === 'A' || value === 'B') && value !== this.#revision) {
      this.#slidePending = value === 'B'
      this.#slideStart = undefined
      this.#revision = value
      this.#buildRack()
      this.#paint()
    }
  }
  get twinRevision(): Revision {
    return this.#revision
  }
  set twinAvionicsUpgraded(value: unknown) {
    if (typeof value === 'boolean' && value !== this.#upgraded) {
      this.#upgraded = value
      this.#dropPending = value
      this.#dropStart = undefined
      this.#paint()
    }
  }
  get twinAvionicsUpgraded(): boolean {
    return this.#upgraded
  }

  #demand(): number {
    return this.#upgraded ? busDemandKw : avionicsChange.existingLoadKw
  }

  connectedCallback(): void {
    for (const key of [
      'twinFocus',
      'twinRevision',
      'twinAvionicsUpgraded',
    ] as const) {
      if (Object.hasOwn(this, key)) {
        const value: unknown = Reflect.get(this, key)
        Reflect.deleteProperty(this, key)
        Reflect.set(this, key, value)
      }
    }
    const root = this.shadowRoot ?? this.attachShadow({ mode: 'open' })
    root.innerHTML =
      '<style>:host{display:block;position:relative;overflow:hidden}canvas{display:block;width:100%;height:100%;outline:none}.label{position:absolute;transform:translate(-50%,-130%);padding:3px 7px;background:#0b1f4d;color:#fff;font:600 11px/1.3 "IBM Plex Mono",monospace;letter-spacing:.4px;white-space:nowrap;cursor:pointer}.label.amber{background:#92400e}.label.red{background:#b91c1c}.label.green{background:#166534}.label::after{content:"";position:absolute;left:50%;bottom:-5px;width:1px;height:5px;background:inherit}.status.fallback{inset:0;display:grid;place-items:center;font:500 13px/1.5 "IBM Plex Sans",system-ui,sans-serif;color:#4b5563;text-align:center;padding:24px}.status{position:absolute;left:12px;bottom:10px;font:500 11px/1.4 "IBM Plex Mono",monospace;color:#4b5563;pointer-events:none}</style>'
    this.#label = document.createElement('div')
    this.#label.className = 'label'
    this.#cockpitLabel = document.createElement('div')
    this.#cockpitLabel.className = 'label amber'
    this.#label.addEventListener('click', () => this.#pick('Power supply'))
    this.#cockpitLabel.addEventListener('click', () => this.#pick('Cockpit'))
    this.#status = document.createElement('div')
    this.#status.className = 'status'
    this.#status.textContent = 'Loading F-35 model…'
    try {
      this.#renderer = new WebGLRenderer({ antialias: true })
    } catch {
      this.#status.textContent =
        'The 3D model needs WebGL, which this browser has turned off. The systems model and review steps still work.'
      this.#status.classList.add('fallback')
      root.append(this.#status)
      return
    }
    const renderer = this.#renderer
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio))
    renderer.setClearColor('#eef1f6')
    root.append(
      renderer.domElement,
      this.#label,
      this.#cockpitLabel,
      this.#status,
    )
    this.#scene.add(
      new HemisphereLight('#ffffff', '#b8c0cc', 1.4),
      new AmbientLight('#ffffff', 0.35),
    )
    const sun = new DirectionalLight('#ffffff', 2.2)
    sun.position.set(4, 6, 3)
    this.#scene.add(sun)
    const grid = new GridHelper(12, 48, '#9fb2dd', '#d5dbe6')
    grid.position.y = -0.87
    this.#scene.add(grid)
    this.#scene.traverse(child => {
      if (child instanceof Light) {
        child.layers.enableAll()
      }
    })
    this.#buildPsu()
    this.#camera.position.copy(this.#preset().position)
    this.#controls = new OrbitControls(this.#camera, renderer.domElement)
    this.#controls.target.copy(this.#preset().target)
    this.#controls.enableDamping = true
    this.#controls.minDistance = 0.6
    this.#controls.maxDistance = 14
    this.#observer = new ResizeObserver(() => this.#resize())
    this.#observer.observe(this)
    this.#resize()
    renderer.domElement.addEventListener('pointerdown', this.#onDown)
    renderer.domElement.addEventListener('pointerup', this.#onUp)
    loadAirframe()
      .then(source => {
        const airframe = source.clone(true)
        airframe.traverse(child => {
          if (child instanceof Mesh) {
            const cloned = toMaterials(Reflect.get(child, 'material')).map(
              restyle,
            )
            Reflect.set(
              child,
              'material',
              cloned.length === 1 ? cloned[0] : cloned,
            )
          }
        })
        this.#airframe = airframe
        this.#scene.add(airframe)
        const bounds = new Box3().setFromObject(airframe)
        const size = bounds.getSize(new Vector3())
        this.#cockpitPosition = new Vector3(
          (bounds.min.x + bounds.max.x) / 2,
          bounds.min.y + size.y * 0.55,
          bounds.min.z + size.z * 0.24,
        )
        this.#cockpit.position.copy(this.#cockpitPosition)
        if (this.#focus === 'Cockpit' && this.#controls) {
          this.#controls.target.copy(this.#preset().target)
          this.#camera.position.copy(this.#preset().position)
        }
        this.#buildFeeder()
        this.#paint()
        this.#applyFocus()
        if (this.#status) {
          this.#status.textContent =
            'Drag to orbit · scroll to zoom · click the cockpit or the aft power assembly to fly there'
        }
        return undefined
      })
      .catch(() => {
        if (this.#status) {
          this.#status.textContent = 'The F-35 model could not be loaded.'
        }
      })
    const tick = (time: number): void => {
      this.#frame = requestAnimationFrame(tick)
      this.#animate(time)
    }
    this.#frame = requestAnimationFrame(tick)
  }

  disconnectedCallback(): void {
    cancelAnimationFrame(this.#frame)
    this.#observer?.disconnect()
    this.#controls?.dispose()
    this.#renderer?.dispose()
    this.#renderer = undefined
    this.#scene = new Scene()
    this.#psu = new Group()
    this.#rack = new Group()
    this.#fixtures = new Group()
    this.#modules = []
    this.#pulses = []
    this.#feeder = undefined
    this.#airframe = undefined
  }

  #onDown = (event: PointerEvent): void => {
    this.#down.set(event.clientX, event.clientY)
  }

  #onUp = (event: PointerEvent): void => {
    const renderer = this.#renderer
    if (
      !renderer ||
      Math.hypot(event.clientX - this.#down.x, event.clientY - this.#down.y) > 5
    ) {
      return
    }
    const rect = renderer.domElement.getBoundingClientRect()
    const pointer = new Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    )
    const raycaster = new Raycaster()
    raycaster.setFromCamera(pointer, this.#camera)
    raycaster.layers.enableAll()
    const targets: Array<Object3D> = [this.#psu]
    if (this.#airframe) {
      targets.push(this.#airframe)
    }
    if (raycaster.intersectObject(this.#cockpit).length > 0) {
      this.#pick('Cockpit')
      return
    }
    const hit = raycaster.intersectObjects(targets, true)[0]
    if (hit && hit.point.z > 0.85) {
      this.#pick('Power supply')
    }
  }

  #pick(part: string): void {
    this.dispatchEvent(new CustomEvent('twin-pick', { detail: { part } }))
  }

  #resize(): void {
    const renderer = this.#renderer
    if (!renderer) {
      return
    }
    const width = Math.max(1, this.clientWidth)
    const height = Math.max(1, this.clientHeight)
    renderer.setSize(width, height, false)
    this.#camera.aspect = width / height
    this.#camera.updateProjectionMatrix()
  }

  #preset(): Preset {
    if (this.#focus !== 'Cockpit') {
      return presets[this.#focus]
    }
    const target = this.#cockpitPosition.clone()
    return {
      target,
      position: target.clone().add(new Vector3(1.0, 0.65, -1.5)),
    }
  }

  #fly(): void {
    if (!this.#controls) {
      this.#flight = undefined
      return
    }
    const preset = this.#preset()
    const fromTarget = this.#controls.target.clone()
    const fromOffset = this.#camera.position.clone().sub(fromTarget)
    const presetOffset = preset.position.clone().sub(preset.target)
    this.#flight = {
      fromOffset,
      toOffset:
        fromOffset.length() < 0.01
          ? presetOffset
          : fromOffset.clone().setLength(presetOffset.length()),
      fromTarget,
      toTarget: preset.target.clone(),
      start: undefined,
    }
  }

  #applyFocus(): void {
    const isAft = this.#focus !== 'Airframe'
    if (this.#airframe) {
      for (const material of materialsOf(this.#airframe)) {
        material.transparent = isAft
        material.opacity = isAft ? 0.16 : 1
        material.depthWrite = !isAft
        material.needsUpdate = true
      }
    }
  }

  #buildPsu(): void {
    this.#psu.add(this.#rack, this.#fixtures)
    this.#psu.position.copy(psuCenter)
    this.#cockpit.renderOrder = 10
    this.#cockpit.position.copy(this.#cockpitPosition)
    this.#scene.add(this.#psu, this.#cockpit)
    this.#buildRack()
    this.#buildFeeder()
    this.#paint()
  }

  #buildRack(): void {
    this.#rack.clear()
    const count = specs[this.#revision].modules
    const width = rackWidth(count)
    const chassis = new Mesh(
      new BoxGeometry(width, rackHeight + 0.02, rackDepth + 0.02),
      new MeshStandardMaterial({
        color: '#cbd2dc',
        metalness: 0.5,
        roughness: 0.4,
        transparent: true,
        opacity: 0.3,
        depthWrite: false,
      }),
    )
    this.#rack.add(chassis)
    this.#modules = Array.from({ length: count }, (_, index) => {
      const mesh = new Mesh(
        new BoxGeometry(moduleWidth, rackHeight, rackDepth),
        new MeshStandardMaterial({
          color: cobalt,
          metalness: 0.35,
          roughness: 0.45,
        }),
      )
      mesh.position.x = slotX(index, count)
      this.#rack.add(mesh)
      return mesh
    })
    this.#buildFixtures(width)
  }

  #buildFeeder(): void {
    if (this.#feeder) {
      this.#scene.remove(this.#feeder)
    }
    for (const pulse of this.#pulses) {
      this.#scene.remove(pulse)
    }
    const start = psuCenter
      .clone()
      .add(new Vector3(0, rackHeight / 2, -rackDepth / 2))
    const end = this.#cockpitPosition.clone()
    const middle = start
      .clone()
      .lerp(end, 0.5)
      .add(new Vector3(0, 0.08, 0))
    this.#curve = new CatmullRomCurve3([start, middle, end])
    this.#feeder = new Mesh(
      new TubeGeometry(this.#curve, 64, 0.007, 8),
      overlayMaterial(green),
    )
    this.#feeder.renderOrder = 9
    this.#pulses = Array.from({ length: 5 }, () => {
      const pulse = new Mesh(
        new SphereGeometry(0.02, 12, 12),
        overlayMaterial(green),
      )
      pulse.renderOrder = 11
      return pulse
    })
    this.#scene.add(this.#feeder, ...this.#pulses)
  }

  #buildFixtures(width: number): void {
    this.#fixtures.clear()
    const spec = specs[this.#revision]
    const plate = new MeshStandardMaterial({
      color: '#9aa3ad',
      metalness: 0.7,
      roughness: 0.3,
    })
    for (let index = 0; index < spec.plates; index++) {
      const slab = new Mesh(
        new BoxGeometry(width * 1.08, 0.012, rackDepth / spec.plates - 0.01),
        plate,
      )
      slab.position.set(
        0,
        -rackHeight / 2 - 0.018,
        -rackDepth / 2 + (rackDepth / spec.plates) * (index + 0.5),
      )
      this.#fixtures.add(slab)
    }
    const bolt = new MeshStandardMaterial({ color: '#1f2937' })
    const perSide = spec.mounts / 2
    for (let index = 0; index < spec.mounts; index++) {
      const side = index < perSide ? -1 : 1
      const step = index % perSide
      const mount = new Mesh(new CylinderGeometry(0.012, 0.012, 0.05, 10), bolt)
      mount.position.set(
        side * (width / 2 + 0.018),
        -rackHeight / 2,
        -rackDepth / 2 + (rackDepth / (perSide - 1)) * step,
      )
      this.#fixtures.add(mount)
    }
    const pipe = new MeshStandardMaterial({ color: '#0f766e' })
    for (const side of [-1, 1]) {
      const line = new Mesh(new CylinderGeometry(0.01, 0.01, 0.3, 10), pipe)
      line.rotation.x = Math.PI / 2
      line.position.set(
        side * width * 0.3,
        -rackHeight / 2 - 0.03,
        -rackDepth / 2 - 0.15,
      )
      this.#fixtures.add(line)
    }
  }

  #paint(): void {
    const isThermal = this.#overlay === 'Thermal'
    const failed = failedCount(this.#condition)
    const load = utilization(this.#revision, this.#condition, this.#demand())
    for (const [index, mesh] of this.#modules.entries()) {
      const isFailed = index < failed
      mesh.material.color = isFailed
        ? new Color('#3f3f46')
        : isThermal
          ? ramp(moduleTemperature(load))
          : load > 1
            ? amber.clone()
            : cobalt.clone()
      mesh.material.emissive = isFailed
        ? new Color('#7f1d1d')
        : new Color('#000000')
      mesh.material.needsUpdate = true
    }
    const color = powerColor(this.#revision, this.#condition, this.#demand())
    this.#cockpit.material.color = new Color(
      this.#upgraded ? '#f59e0b' : '#64748b',
    )
    this.#cockpit.material.emissive = new Color(
      this.#upgraded ? '#f59e0b' : '#1e293b',
    )
    for (const item of [this.#feeder, ...this.#pulses]) {
      if (item) {
        item.material.color = color.clone()
        item.material.emissive = color.clone()
      }
    }
  }

  #animate(time: number): void {
    const renderer = this.#renderer
    if (!renderer) {
      return
    }
    if (this.#flight && this.#flight.start === undefined) {
      this.#flight = { ...this.#flight, start: time }
    }
    if (this.#flight && this.#controls) {
      const t = Math.min(1, (time - (this.#flight.start ?? time)) / 1300)
      const eased = easeInOut(t)
      this.#controls.target.lerpVectors(
        this.#flight.fromTarget,
        this.#flight.toTarget,
        eased,
      )
      this.#camera.position
        .lerpVectors(this.#flight.fromOffset, this.#flight.toOffset, eased)
        .add(this.#controls.target)
      if (t >= 1) {
        this.#flight = undefined
      }
    }
    const count = specs[this.#revision].modules
    const slid = this.#modules[count - 1]
    if (this.#slidePending) {
      this.#slidePending = false
      this.#slideStart = time
    }
    if (this.#slideStart !== undefined && slid) {
      const t = Math.min(1, Math.max(0, (time - this.#slideStart) / 1100))
      const eased = easeInOut(t)
      slid.position.set(
        slotX(count - 1, count) + (1 - eased) * 0.5,
        (1 - eased) * 0.3,
        0,
      )
      if (t >= 1) {
        this.#slideStart = undefined
      }
    }
    const pulse =
      this.#focus !== 'Airframe' ? 1 : 1 + Math.sin(time / 380) * 0.05
    this.#psu.scale.setScalar(pulse)
    if (this.#dropPending) {
      this.#dropPending = false
      this.#dropStart = time
    }
    const drop =
      this.#dropStart === undefined
        ? 1
        : easeInOut(Math.min(1, (time - this.#dropStart) / 1100))
    if (drop >= 1) {
      this.#dropStart = undefined
    }
    this.#cockpit.position
      .copy(this.#cockpitPosition)
      .add(new Vector3(0, (1 - drop) * 0.6, 0))
    this.#cockpit.scale.setScalar(this.#upgraded ? 1 : 0.75)
    this.#cockpit.material.emissiveIntensity = !this.#upgraded
      ? 0.2
      : 0.45 + Math.sin(time / 260) * 0.35
    const load = utilization(this.#revision, this.#condition, this.#demand())
    const curve = this.#curve
    if (curve) {
      for (const [index, item] of this.#pulses.entries()) {
        const speed = load > 1 ? 4200 : 1800
        const t = (time / speed + index / this.#pulses.length) % 1
        item.position.copy(curve.getPointAt(t))
        item.material.opacity =
          load > 1 ? 0.35 + 0.6 * Math.abs(Math.sin(time / 90 + index)) : 0.95
      }
    }
    this.#controls?.update()
    this.#psu.traverse(child => child.layers.set(1))
    renderer.autoClear = true
    this.#camera.layers.set(0)
    renderer.render(this.#scene, this.#camera)
    renderer.autoClear = false
    renderer.clearDepth()
    this.#camera.layers.set(1)
    renderer.render(this.#scene, this.#camera)
    this.#camera.layers.set(0)
    this.#place(
      this.#label,
      psuCenter.clone().add(new Vector3(0, rackHeight / 2 + 0.02, 0)),
    )
    this.#place(
      this.#cockpitLabel,
      this.#cockpitPosition.clone().add(new Vector3(0, 0.05, 0)),
    )
    const label = this.#label
    if (label) {
      const failed = failedCount(this.#condition)
      const available = capacityKw(this.#revision, failed)
      const isShort = load > 1
      const demand = this.#demand()
      const tone = powerColor(this.#revision, this.#condition, demand)
      label.className = `label ${tone === red ? 'red' : tone === amber ? 'amber' : 'green'}`
      const verdict = isShort
        ? ` · SHORT ${(demand - available).toFixed(1)} kW`
        : failed === 0 && demand > capacityKw(this.#revision, 1)
          ? ' · no N−1 margin'
          : ' · OK'
      const temperature =
        this.#overlay === 'Thermal'
          ? ` · ${Math.round(moduleTemperature(load))} °C`
          : ''
      label.textContent = `MPA Rev ${this.#revision} · ${count - failed}/${count} modules · ${available.toFixed(1)} kW for ${demand.toFixed(1)} kW${verdict}${temperature}`
    }
    if (this.#cockpitLabel) {
      this.#cockpitLabel.className = `label ${this.#upgraded ? 'amber' : ''}`
      this.#cockpitLabel.textContent = this.#upgraded
        ? `${avionicsChange.id} · new cockpit avionics ${avionicsChange.steadyKw} kW (+${(avionicsChange.steadyKw - avionicsChange.replacedKw).toFixed(1)})`
        : `Cockpit avionics · ${avionicsChange.replacedKw} kW`
    }
  }

  #place(element: HTMLDivElement | undefined, point: Vector3): void {
    if (!element) {
      return
    }
    const projected = point.project(this.#camera)
    element.style.display = projected.z > 1 ? 'none' : ''
    element.style.left = `${((projected.x + 1) / 2) * this.clientWidth}px`
    element.style.top = `${((1 - projected.y) / 2) * this.clientHeight}px`
  }
}

if (!customElements.get('stream-twin')) {
  customElements.define('stream-twin', StreamTwin)
}
