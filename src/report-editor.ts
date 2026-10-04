import { Editor } from '@tiptap/core'
import { TableKit } from '@tiptap/extension-table'
import { Markdown } from '@tiptap/markdown'
import { StarterKit } from '@tiptap/starter-kit'

type Tool = Readonly<{
  label: string
  text: string
  run: (editor: Editor) => boolean
  isActive?: (editor: Editor) => boolean
}>

const tools: ReadonlyArray<Tool | 'separator'> = [
  {
    label: 'Bold',
    text: 'B',
    run: editor => editor.chain().focus().toggleBold().run(),
    isActive: editor => editor.isActive('bold'),
  },
  {
    label: 'Italic',
    text: 'I',
    run: editor => editor.chain().focus().toggleItalic().run(),
    isActive: editor => editor.isActive('italic'),
  },
  'separator',
  {
    label: 'Heading',
    text: 'H2',
    run: editor => editor.chain().focus().toggleHeading({ level: 2 }).run(),
    isActive: editor => editor.isActive('heading', { level: 2 }),
  },
  {
    label: 'Bulleted list',
    text: '•',
    run: editor => editor.chain().focus().toggleBulletList().run(),
    isActive: editor => editor.isActive('bulletList'),
  },
  {
    label: 'Numbered list',
    text: '1.',
    run: editor => editor.chain().focus().toggleOrderedList().run(),
    isActive: editor => editor.isActive('orderedList'),
  },
  'separator',
  {
    label: 'Add table row',
    text: '+Row',
    run: editor => editor.chain().focus().addRowAfter().run(),
  },
  {
    label: 'Delete table row',
    text: '−Row',
    run: editor => editor.chain().focus().deleteRow().run(),
  },
  'separator',
  {
    label: 'Undo',
    text: '↶',
    run: editor => editor.chain().focus().undo().run(),
  },
  {
    label: 'Redo',
    text: '↷',
    run: editor => editor.chain().focus().redo().run(),
  },
]

const entities: Readonly<Record<string, string>> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
}

const decodeEntities = (markdown: string): string =>
  markdown.replaceAll(
    /&(?:amp|lt|gt|quot|#39);/g,
    entity => entities[entity] ?? entity,
  )

export class StreamReportEditor extends HTMLElement {
  #name = ''
  #markdown = ''
  #shownName = ''
  #shownMarkdown = ''
  #editor: Editor | undefined
  #buttons: Array<Readonly<{ tool: Tool; button: HTMLButtonElement }>> = []
  #isQueued = false

  set reportName(value: unknown) {
    if (typeof value === 'string') {
      this.#name = value
      this.#queue()
    }
  }
  get reportName(): string {
    return this.#name
  }
  set markdown(value: unknown) {
    if (typeof value === 'string') {
      this.#markdown = value
      this.#queue()
    }
  }
  get markdown(): string {
    return this.#markdown
  }

  connectedCallback(): void {
    if (this.#editor) {
      return
    }
    const toolbar = document.createElement('div')
    toolbar.className = 'report-toolbar'
    toolbar.setAttribute('role', 'toolbar')
    toolbar.setAttribute('aria-label', 'Formatting')
    this.#buttons = []
    for (const tool of tools) {
      if (tool === 'separator') {
        const separator = document.createElement('span')
        separator.className = 'report-toolbar-separator'
        toolbar.append(separator)
        continue
      }
      const button = document.createElement('button')
      button.type = 'button'
      button.textContent = tool.text
      button.title = tool.label
      button.setAttribute('aria-label', tool.label)
      button.addEventListener('mousedown', event => event.preventDefault())
      button.addEventListener('click', () => {
        if (this.#editor) {
          tool.run(this.#editor)
        }
      })
      this.#buttons.push({ tool, button })
      toolbar.append(button)
    }
    const surface = document.createElement('div')
    surface.className = 'report-surface'
    this.append(toolbar, surface)
    this.#editor = new Editor({
      element: surface,
      extensions: [StarterKit, TableKit, Markdown],
      content: this.#markdown,
      contentType: 'markdown',
      editorProps: {
        attributes: {
          class: 'markdown-body report-prose',
          role: 'textbox',
          'aria-multiline': 'true',
          'aria-label': 'Report editor',
          spellcheck: 'true',
        },
      },
      onUpdate: ({ editor }) => {
        const markdown = decodeEntities(editor.getMarkdown())
        this.#shownName = this.#name
        this.#shownMarkdown = markdown
        this.dispatchEvent(
          new CustomEvent('report-input', {
            detail: { name: this.#name, markdown },
          }),
        )
      },
      onTransaction: () => this.#paintToolbar(),
    })
    this.#shownName = this.#name
    this.#shownMarkdown = this.#markdown
    this.#paintToolbar()
  }

  disconnectedCallback(): void {
    this.#editor?.destroy()
    this.#editor = undefined
    this.replaceChildren()
  }

  #queue(): void {
    if (this.#isQueued) {
      return
    }
    this.#isQueued = true
    queueMicrotask(() => {
      this.#isQueued = false
      this.#sync()
    })
  }

  #sync(): void {
    const editor = this.#editor
    if (
      !editor ||
      (this.#name === this.#shownName && this.#markdown === this.#shownMarkdown)
    ) {
      return
    }
    editor.commands.setContent(this.#markdown, {
      contentType: 'markdown',
      emitUpdate: false,
    })
    this.#shownName = this.#name
    this.#shownMarkdown = this.#markdown
  }

  #paintToolbar(): void {
    const editor = this.#editor
    if (!editor) {
      return
    }
    for (const { tool, button } of this.#buttons) {
      if (tool.isActive) {
        button.setAttribute('aria-pressed', String(tool.isActive(editor)))
      }
    }
  }
}

if (!customElements.get('stream-report-editor')) {
  customElements.define('stream-report-editor', StreamReportEditor)
}
