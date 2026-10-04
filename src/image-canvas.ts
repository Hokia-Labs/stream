import Panzoom, { type PanzoomObject } from '@panzoom/panzoom'

const minScale = 0.25
const maxScale = 12

const styles = `
:host{display:block;position:relative;overflow:hidden;background:#f3f4f6 radial-gradient(circle,#d4d4d8 0.8px,transparent 0.85px) 0 0/16px 16px;border:1px solid #e5e7eb;border-radius:6px;outline:none;touch-action:none;user-select:none}
:host(:focus-visible){box-shadow:0 0 0 2px #2563eb}
.stage{position:absolute;inset:0;display:grid;place-items:center}
img{display:block;max-width:none;box-shadow:0 1px 3px rgba(15,23,42,.12);background:#fff;-webkit-user-drag:none}
.controls{position:absolute;right:8px;bottom:8px;display:flex;align-items:center;gap:2px;padding:2px;background:#fff;border:1px solid #e5e7eb;border-radius:6px;box-shadow:0 1px 2px rgba(15,23,42,.08);font:500 12px/1 "IBM Plex Sans",system-ui,sans-serif;color:#111827}
button{all:unset;cursor:pointer;min-width:24px;height:24px;padding:0 6px;box-sizing:border-box;display:grid;place-items:center;border-radius:4px}
button:hover{background:#f3f4f6}
button:focus-visible{box-shadow:0 0 0 2px #2563eb}
output{min-width:40px;text-align:center;font-variant-numeric:tabular-nums}
.hint{position:absolute;left:8px;bottom:8px;margin:0;font:400 11px/1.4 "IBM Plex Sans",system-ui,sans-serif;color:#6b7280;pointer-events:none}
`

export class StreamImageCanvas extends HTMLElement {
  #src = ''
  #alt = ''
  #fit = 1
  #panzoom: PanzoomObject | undefined
  #observer: ResizeObserver | undefined
  #image: HTMLImageElement | undefined
  #zoomLabel: HTMLOutputElement | undefined

  set src(value: unknown) {
    const next = typeof value === 'string' ? value : ''
    if (next === this.#src) {
      return
    }
    this.#src = next
    if (this.#image) {
      this.#image.src = next
    }
  }

  get src(): string {
    return this.#src
  }

  set alt(value: unknown) {
    this.#alt = typeof value === 'string' ? value : ''
    if (this.#image) {
      this.#image.alt = this.#alt
    }
  }

  get alt(): string {
    return this.#alt
  }

  connectedCallback(): void {
    const root = this.shadowRoot ?? this.attachShadow({ mode: 'open' })
    root.innerHTML = `<style>${styles}</style><div class="stage"><img draggable="false"></div><p class="hint">Drag or scroll to pan · ⌘ scroll or pinch to zoom · ⇧1 fit</p><div class="controls"><button type="button" data-action="out" title="Zoom out (−)" aria-label="Zoom out">−</button><output aria-live="polite">100%</output><button type="button" data-action="in" title="Zoom in (+)" aria-label="Zoom in">+</button><button type="button" data-action="fit" title="Zoom to fit (⇧1)">Fit</button><button type="button" data-action="actual" title="Actual size (⇧0)">1:1</button></div>`
    if (!this.hasAttribute('tabindex')) {
      this.tabIndex = 0
    }
    const image = root.querySelector('img')
    const label = root.querySelector('output')
    if (!image || !label) {
      return
    }
    this.#image = image
    this.#zoomLabel = label
    image.alt = this.#alt
    image.addEventListener('load', this.#layout)
    image.src = this.#src
    this.#panzoom = Panzoom(image, {
      canvas: true,
      minScale,
      maxScale,
      cursor: 'grab',
      animate: false,
      exclude: [...root.querySelectorAll('.controls, .controls *')],
    })
    image.addEventListener('panzoomchange', this.#updateLabel)
    this.addEventListener('wheel', this.#wheel, { passive: false })
    this.addEventListener('keydown', this.#key)
    root.querySelector('.controls')?.addEventListener('click', this.#click)
    this.#observer = new ResizeObserver(this.#layout)
    this.#observer.observe(this)
  }

  disconnectedCallback(): void {
    this.#observer?.disconnect()
    this.#panzoom?.destroy()
    this.removeEventListener('wheel', this.#wheel)
    this.removeEventListener('keydown', this.#key)
    this.#panzoom = undefined
  }

  #layout = (): void => {
    const image = this.#image
    if (!image || image.naturalWidth === 0) {
      return
    }
    const width = this.clientWidth - 32
    const height = this.clientHeight - 48
    this.#fit = Math.min(
      width / image.naturalWidth,
      height / image.naturalHeight,
    )
    image.style.width = `${Math.round(image.naturalWidth * this.#fit)}px`
    image.style.height = `${Math.round(image.naturalHeight * this.#fit)}px`
    this.#panzoom?.reset({ animate: false })
    this.#updateLabel()
  }

  #fitView = (): void => {
    this.#panzoom?.reset({ animate: false })
    this.#updateLabel()
  }

  #updateLabel = (): void => {
    const scale = this.#panzoom?.getScale() ?? 1
    if (this.#zoomLabel) {
      this.#zoomLabel.value = `${Math.round(scale * this.#fit * 100)}%`
    }
  }

  #zoomAround = (scale: number, clientX: number, clientY: number): void => {
    this.#panzoom?.zoomToPoint(
      Math.min(maxScale, Math.max(minScale, scale)),
      { clientX, clientY },
      { animate: false },
    )
    this.#updateLabel()
  }

  #zoomCentre = (factor: number): void => {
    const box = this.getBoundingClientRect()
    this.#zoomAround(
      (this.#panzoom?.getScale() ?? 1) * factor,
      box.left + box.width / 2,
      box.top + box.height / 2,
    )
  }

  #wheel = (event: WheelEvent): void => {
    const panzoom = this.#panzoom
    if (!panzoom) {
      return
    }
    event.preventDefault()
    if (event.ctrlKey || event.metaKey) {
      this.#zoomAround(
        panzoom.getScale() *
          Math.exp(-Math.max(-30, Math.min(30, event.deltaY)) * 0.01),
        event.clientX,
        event.clientY,
      )
      return
    }
    const scale = panzoom.getScale()
    const isSideways = event.shiftKey && event.deltaX === 0
    const dx = isSideways ? event.deltaY : event.deltaX
    const dy = isSideways ? 0 : event.deltaY
    panzoom.pan(-dx / scale, -dy / scale, { relative: true, animate: false })
  }

  #key = (event: KeyboardEvent): void => {
    if (event.shiftKey && event.code === 'Digit1') {
      this.#fitView()
    } else if (event.shiftKey && event.code === 'Digit0') {
      this.#zoomCentre(1 / this.#fit / (this.#panzoom?.getScale() ?? 1))
    } else if (event.key === '+' || event.key === '=') {
      this.#zoomCentre(1.25)
    } else if (event.key === '-' || event.key === '_') {
      this.#zoomCentre(0.8)
    } else {
      return
    }
    event.preventDefault()
  }

  #click = (event: Event): void => {
    const target = event.target
    const action =
      target instanceof HTMLElement ? target.dataset['action'] : undefined
    if (action === 'in') {
      this.#zoomCentre(1.25)
    } else if (action === 'out') {
      this.#zoomCentre(0.8)
    } else if (action === 'fit') {
      this.#fitView()
    } else if (action === 'actual') {
      this.#zoomCentre(1 / this.#fit / (this.#panzoom?.getScale() ?? 1))
    }
  }
}

if (!customElements.get('stream-image-canvas')) {
  customElements.define('stream-image-canvas', StreamImageCanvas)
}
