import {
  AmbientLight,
  Box3,
  DirectionalLight,
  Group,
  HemisphereLight,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

export const boardModels = [
  { name: 'Board 1', url: '/models/board1.glb' },
  { name: 'Board 2', url: '/models/board2.glb' },
  { name: 'Board 3', url: '/models/board3.glb' },
] as const

const spacing = 150

export class StreamBoard extends HTMLElement {
  #renderer: WebGLRenderer | undefined
  #scene = new Scene()
  #camera = new PerspectiveCamera(30, 1, 1, 5000)
  #controls: OrbitControls | undefined
  #observer: ResizeObserver | undefined
  #frame = 0

  connectedCallback(): void {
    const root = this.shadowRoot ?? this.attachShadow({ mode: 'open' })
    root.innerHTML =
      '<style>:host{display:block;position:relative;overflow:hidden;background:#eef1f6}canvas{display:block;width:100%;height:100%;outline:none;opacity:0;transition:opacity .7s cubic-bezier(.2,.7,.2,1)}:host([data-ready]) canvas{opacity:1}p{margin:0;position:absolute;inset:0;display:grid;place-items:center;font:500 13px/1.5 "IBM Plex Sans",system-ui,sans-serif;color:#4b5563;pointer-events:none}:host([data-ready]) p{display:none}</style><p>Loading KiCad assemblies…</p>'
    try {
      this.#renderer = new WebGLRenderer({ antialias: true })
    } catch {
      root.querySelector('p')?.replaceChildren('3D needs WebGL.')
      return
    }
    const renderer = this.#renderer
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio))
    renderer.setClearColor('#eef1f6')
    root.append(renderer.domElement)
    this.#scene.add(
      new HemisphereLight('#ffffff', '#b8c0cc', 1.6),
      new AmbientLight('#ffffff', 0.4),
    )
    const sun = new DirectionalLight('#ffffff', 2.2)
    sun.position.set(200, 400, 250)
    this.#scene.add(sun)
    this.#controls = new OrbitControls(this.#camera, renderer.domElement)
    this.#controls.enableDamping = true
    this.#load().catch(() => undefined)
    this.#observer = new ResizeObserver(() => this.#resize())
    this.#observer.observe(this)
    this.#resize()
    const tick = (): void => {
      this.#controls?.update()
      renderer.render(this.#scene, this.#camera)
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
    const height = Math.max(1, this.clientHeight)
    this.#renderer?.setSize(width, height, false)
    this.#camera.aspect = width / height
    this.#camera.updateProjectionMatrix()
  }

  async #load(): Promise<void> {
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
    const boards = new Group()
    boards.rotation.x = -Math.PI / 2
    this.#scene.add(boards)
    try {
      const scenes = await Promise.all(
        boardModels.map(board => loader.loadAsync(board.url)),
      )
      scenes.forEach((gltf, index) => {
        gltf.scene.position.x = index * spacing
        boards.add(gltf.scene)
      })
    } catch {
      this.shadowRoot
        ?.querySelector('p')
        ?.replaceChildren('Could not load the KiCad assemblies.')
      return
    }
    const box = new Box3().setFromObject(boards)
    const center = box.getCenter(new Vector3())
    const size = box.getSize(new Vector3()).length()
    this.#controls?.target.copy(center)
    this.#camera.position.set(
      center.x + size * 0.15,
      center.y + size * 0.55,
      center.z + size * 0.6,
    )
    this.toggleAttribute('data-ready', true)
  }
}

if (!customElements.get('stream-board')) {
  customElements.define('stream-board', StreamBoard)
}
