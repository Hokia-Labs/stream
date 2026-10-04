import {
  AmbientLight,
  BoxGeometry,
  Color,
  DirectionalLight,
  EdgesGeometry,
  GridHelper,
  HemisphereLight,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

import { heatScale, thermal } from './board-review'

type Revision = 'A' | 'B'

const moduleWidth = 0.62
const gap = 0.1
const depth = 3.2
const height = 1.2
const rackWidth = (count: number): number => count * (moduleWidth + gap) + gap

const ramp = (temperature: number): Color => {
  const t = Math.min(
    1,
    Math.max(
      0,
      (temperature - heatScale.min) / (heatScale.max - heatScale.min),
    ),
  )
  return new Color().setHSL(0.62 * (1 - t), 0.85, 0.5)
}

export class StreamRack extends HTMLElement {
  #revision: Revision = 'A'
  #renderer: WebGLRenderer | undefined
  #scene = new Scene()
  #camera = new PerspectiveCamera(35, 1, 0.1, 100)
  #controls: OrbitControls | undefined
  #observer: ResizeObserver | undefined
  #frame = 0

  set rackRevision(value: unknown) {
    if ((value === 'A' || value === 'B') && value !== this.#revision) {
      this.#revision = value
      this.#build()
    }
  }
  get rackRevision(): Revision {
    return this.#revision
  }

  connectedCallback(): void {
    if (Object.hasOwn(this, 'rackRevision')) {
      const value: unknown = Reflect.get(this, 'rackRevision')
      Reflect.deleteProperty(this, 'rackRevision')
      Reflect.set(this, 'rackRevision', value)
    }
    const root = this.shadowRoot ?? this.attachShadow({ mode: 'open' })
    root.innerHTML =
      '<style>:host{display:block;position:relative;overflow:hidden;background:#eef1f6}canvas{display:block;width:100%;height:100%;outline:none;opacity:0;transform:scale(1.015);transition:opacity .7s cubic-bezier(.2,.7,.2,1),transform .9s cubic-bezier(.2,.7,.2,1)}:host([data-ready]) canvas{opacity:1;transform:none}@media (prefers-reduced-motion:reduce){canvas{transition:opacity .2s linear;transform:none}}p{margin:0;position:absolute;inset:0;display:grid;place-items:center;font:500 13px/1.5 "IBM Plex Sans",system-ui,sans-serif;color:#4b5563}</style>'
    try {
      this.#renderer = new WebGLRenderer({ antialias: true })
    } catch {
      const note = document.createElement('p')
      note.textContent = '3D needs WebGL.'
      root.append(note)
      return
    }
    const renderer = this.#renderer
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio))
    renderer.setClearColor('#eef1f6')
    root.append(renderer.domElement)
    this.#camera.position.set(4.2, 3.4, 5.4)
    this.#controls = new OrbitControls(this.#camera, renderer.domElement)
    this.#controls.enableDamping = true
    this.#controls.target.set(0, 0.3, 0)
    this.#build()
    this.#observer = new ResizeObserver(() => this.#resize())
    this.#observer.observe(this)
    this.#resize()
    const tick = (): void => {
      this.#controls?.update()
      renderer.render(this.#scene, this.#camera)
      if (!this.hasAttribute('data-ready')) {
        this.toggleAttribute('data-ready', true)
      }
      this.#frame = requestAnimationFrame(tick)
    }
    this.#frame = requestAnimationFrame(tick)
  }

  disconnectedCallback(): void {
    cancelAnimationFrame(this.#frame)
    this.#observer?.disconnect()
    this.#controls?.dispose()
    this.#renderer?.dispose()
    this.#renderer = undefined
  }

  #resize(): void {
    const width = Math.max(1, this.clientWidth)
    const heightPx = Math.max(1, this.clientHeight)
    this.#renderer?.setSize(width, heightPx, false)
    this.#camera.aspect = width / heightPx
    this.#camera.updateProjectionMatrix()
  }

  #build(): void {
    this.#scene = new Scene()
    this.#scene.add(
      new HemisphereLight('#ffffff', '#b8c0cc', 1.4),
      new AmbientLight('#ffffff', 0.3),
    )
    const sun = new DirectionalLight('#ffffff', 2)
    sun.position.set(4, 6, 3)
    this.#scene.add(sun)
    const grid = new GridHelper(10, 20, '#9fb2dd', '#d5dbe6')
    grid.position.y = -0.35
    this.#scene.add(grid)
    const isB = this.#revision === 'B'
    const count = isB ? 5 : 4
    const width = rackWidth(count)
    const plates = isB ? 2 : 1
    for (let plate = 0; plate < plates; plate++) {
      const mesh = new Mesh(
        new BoxGeometry(width / plates - 0.04, 0.12, depth + 0.2),
        new MeshStandardMaterial({
          color: '#9aa3ad',
          metalness: 0.7,
          roughness: 0.3,
        }),
      )
      mesh.position.set(-width / 2 + (width / plates) * (plate + 0.5), -0.26, 0)
      this.#scene.add(mesh)
    }
    const chassis = new Mesh(
      new BoxGeometry(width, height + 0.1, depth + 0.1),
      new MeshStandardMaterial({
        color: '#cbd2dc',
        transparent: true,
        opacity: 0.25,
        depthWrite: false,
      }),
    )
    chassis.position.y = height / 2 - 0.2
    this.#scene.add(chassis)
    const hot = ramp(thermal(this.#revision).coldPlateC + 8)
    for (let index = 0; index < count; index++) {
      const isFailed = index === 0
      const isAdded = isB && index === 4
      const mesh = new Mesh(
        new BoxGeometry(moduleWidth, height, depth),
        new MeshStandardMaterial({
          color: isFailed ? '#4a1414' : hot,
          metalness: 0.3,
          roughness: 0.5,
        }),
      )
      mesh.position.set(
        -width / 2 + gap + moduleWidth / 2 + index * (moduleWidth + gap),
        height / 2 - 0.2,
        0,
      )
      this.#scene.add(mesh)
      if (isAdded) {
        const edges = new LineSegments(
          new EdgesGeometry(mesh.geometry),
          new LineBasicMaterial({ color: '#16a34a' }),
        )
        edges.position.copy(mesh.position)
        edges.scale.setScalar(1.04)
        this.#scene.add(edges)
      }
    }
  }
}

if (!customElements.get('stream-rack')) {
  customElements.define('stream-rack', StreamRack)
}
