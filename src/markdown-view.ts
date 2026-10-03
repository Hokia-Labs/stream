import type { Html, HtmlBuilder } from 'foldkit/html'
import { type Token, type Tokens, marked } from 'marked'

import type { Message } from './message'

type H = HtmlBuilder<Message>

const safeHref = /^(?:(?:https?|mailto):|#|\/(?!\/))/i

const entities: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: '\u00a0',
}

export const decodeEntities = (text: string): string =>
  text.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (match, name: string) => {
    if (name.startsWith('#')) {
      const code =
        name[1] === 'x' || name[1] === 'X'
          ? Number.parseInt(name.slice(2), 16)
          : Number.parseInt(name.slice(1), 10)
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : match
    }
    return entities[name.toLowerCase()] ?? match
  })

const isHeading = (token: Token): token is Tokens.Heading =>
  token.type === 'heading'
const isParagraph = (token: Token): token is Tokens.Paragraph =>
  token.type === 'paragraph'
const isList = (token: Token): token is Tokens.List => token.type === 'list'
const isTable = (token: Token): token is Tokens.Table => token.type === 'table'
const isCode = (token: Token): token is Tokens.Code => token.type === 'code'
const isBlockquote = (token: Token): token is Tokens.Blockquote =>
  token.type === 'blockquote'
const isLink = (token: Token): token is Tokens.Link => token.type === 'link'
const isImage = (token: Token): token is Tokens.Image => token.type === 'image'
const isCodespan = (token: Token): token is Tokens.Codespan =>
  token.type === 'codespan'
const isStrong = (token: Token): token is Tokens.Strong =>
  token.type === 'strong'
const isEm = (token: Token): token is Tokens.Em => token.type === 'em'
const isDel = (token: Token): token is Tokens.Del => token.type === 'del'
const isText = (token: Token): token is Tokens.Text => token.type === 'text'

const rawText = (token: Token): string =>
  'text' in token && typeof token.text === 'string' ? token.text : token.raw

const inline = (
  tokens: ReadonlyArray<Token> | undefined,
  h: H,
): ReadonlyArray<Html | string> =>
  (tokens ?? []).map((token): Html | string => {
    if (isStrong(token)) {
      return h.strong([], inline(token.tokens, h))
    }
    if (isEm(token)) {
      return h.em([], inline(token.tokens, h))
    }
    if (isDel(token)) {
      return h.del([], inline(token.tokens, h))
    }
    if (isCodespan(token)) {
      return h.code([], [decodeEntities(token.text)])
    }
    if (token.type === 'br') {
      return h.br([])
    }
    if (isLink(token)) {
      const label = inline(token.tokens, h)
      return safeHref.test(token.href)
        ? h.a(
            [
              h.Href(token.href),
              h.Target('_blank'),
              h.Rel('noopener noreferrer'),
            ],
            label,
          )
        : h.span([], label)
    }
    if (isImage(token)) {
      return decodeEntities(token.text)
    }
    if (isText(token) && token.tokens) {
      return h.span([], inline(token.tokens, h))
    }
    return token.type === 'html' ? token.raw : decodeEntities(rawText(token))
  })

const heading = (depth: number, h: H) =>
  depth <= 1 ? h.h3 : depth === 2 ? h.h4 : depth === 3 ? h.h5 : h.h6

const blocks = (tokens: ReadonlyArray<Token>, h: H): ReadonlyArray<Html> =>
  tokens.flatMap((token): ReadonlyArray<Html> => {
    if (token.type === 'space') {
      return []
    }
    if (isHeading(token)) {
      return [heading(token.depth, h)([], inline(token.tokens, h))]
    }
    if (isParagraph(token)) {
      return [h.p([], inline(token.tokens, h))]
    }
    if (isText(token)) {
      return [
        h.span(
          [],
          token.tokens ? inline(token.tokens, h) : [decodeEntities(token.text)],
        ),
      ]
    }
    if (isList(token)) {
      const items = token.items.map(item =>
        h.li(item.task ? [h.Class('task-item')] : [], [
          ...(item.task
            ? [
                h.input([
                  h.Type('checkbox'),
                  h.Checked(item.checked === true),
                  h.Disabled(true),
                ]),
              ]
            : []),
          ...blocks(item.tokens, h),
        ]),
      )
      const start = typeof token.start === 'number' ? token.start : 1
      return [
        token.ordered
          ? h.ol(start === 1 ? [] : [h.Start(start)], items)
          : h.ul([], items),
      ]
    }
    if (isCode(token)) {
      return [h.pre([], [h.code([], [token.text])])]
    }
    if (isBlockquote(token)) {
      return [h.blockquote([], blocks(token.tokens, h))]
    }
    if (isTable(token)) {
      const align = (index: number) => {
        const value = token.align[index]
        return value ? [h.Style({ textAlign: value })] : []
      }
      return [
        h.div(
          [h.Class('table-scroll')],
          [
            h.table(
              [],
              [
                h.thead(
                  [],
                  [
                    h.tr(
                      [],
                      token.header.map((cell, index) =>
                        h.th(align(index), inline(cell.tokens, h)),
                      ),
                    ),
                  ],
                ),
                h.tbody(
                  [],
                  token.rows.map(row =>
                    h.tr(
                      [],
                      row.map((cell, index) =>
                        h.td(align(index), inline(cell.tokens, h)),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ]
    }
    if (token.type === 'hr') {
      return [h.hr([])]
    }
    return [h.p([], [token.type === 'html' ? token.raw : rawText(token)])]
  })

export const markdownView = (text: string, h: H): ReadonlyArray<Html> =>
  blocks(marked.lexer(text, { gfm: true, breaks: true }), h)
