import { type Token, type Tokens, marked } from 'marked'

export type Level = 'error' | 'warn' | 'info'
export type Severity = 'Error' | 'Warning' | 'Info' | 'Pass'

export interface FindingSummary {
  readonly title: string
  readonly preview: string
  readonly severity: Severity
  readonly findings: number
  readonly tables: number
}

const errorPattern =
  /\b(fail|failed|failure|aborted|exception|crashed)\b|\berror:/i
const warnPattern =
  /\b(warn|warning|cancel|cancelled|lack|lacks|without|missing|required|unverified)\b/i

export const levelOf = (text: string): Level =>
  errorPattern.test(text) ? 'error' : warnPattern.test(text) ? 'warn' : 'info'

export const severityLevel = (severity: Severity): Level =>
  severity === 'Error' ? 'error' : severity === 'Warning' ? 'warn' : 'info'

export const findingPreviewLength = 160

export const markdownToPlainText = (text: string): string =>
  text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}(?:#{1,6}|>|[-*+]|\d+[.)])\s+/gm, '')
    .replace(/\*\*|__|~~|`|\*/g, '')
    .replace(/^\s*\|?\s*:?-{3,}.*$/gm, ' ')
    .replace(/\|/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const truncate = (plain: string, max: number): string => {
  if (plain.length <= max) {
    return plain
  }
  const cut = plain.slice(0, max)
  const space = cut.lastIndexOf(' ')
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`
}

export const markdownPreview = (
  text: string,
  max: number = findingPreviewLength,
): string => truncate(markdownToPlainText(text), max)

export const isLongFinding = (text: string): boolean =>
  markdownToPlainText(text).length > findingPreviewLength ||
  text.trim().includes('\n')

const lex = (text: string): ReadonlyArray<Token> =>
  marked.lexer(text, { gfm: true })

const isHeading = (token: Token): token is Tokens.Heading =>
  token.type === 'heading'
const isParagraph = (token: Token): token is Tokens.Paragraph =>
  token.type === 'paragraph'
const isList = (token: Token): token is Tokens.List => token.type === 'list'
const isTable = (token: Token): token is Tokens.Table => token.type === 'table'
const isCode = (token: Token): token is Tokens.Code => token.type === 'code'

const tokenLines = (token: Token): ReadonlyArray<string> => {
  if (isHeading(token)) {
    return [`§ ${markdownToPlainText(token.text)}`]
  }
  if (isList(token)) {
    return token.items.map(item => markdownToPlainText(item.text))
  }
  if (isTable(token)) {
    return [token.header, ...token.rows].map(row =>
      row.map(cell => markdownToPlainText(cell.text)).join(' · '),
    )
  }
  if (isCode(token)) {
    return [`code (${token.text.split('\n').length} lines)`]
  }
  if (token.type === 'space' || token.type === 'hr') {
    return []
  }
  return 'text' in token && typeof token.text === 'string'
    ? [markdownToPlainText(token.text)]
    : []
}

export const markdownBlocks = (text: string): ReadonlyArray<string> =>
  lex(text)
    .flatMap(tokenLines)
    .filter(line => line.length > 0)

const severityLine =
  /^severity\s*[:-]\s*(critical|high|medium|low|info|pass)\b/i
const genericHeading =
  /^(summary|overview|findings?|results?|report|analysis|conclusion)$/i

const severityOf = (tag: string): Severity =>
  tag === 'critical' || tag === 'high'
    ? 'Error'
    : tag === 'medium'
      ? 'Warning'
      : tag === 'pass'
        ? 'Pass'
        : 'Info'

const firstSentence = (text: string): string =>
  text.split(/(?<=[.!?])\s+/)[0] ?? text

const summaries = new Map<string, FindingSummary>()

const summarize = (
  text: string,
  status: string | undefined,
): FindingSummary => {
  const tokens = lex(text)
  const paragraphs = tokens
    .filter(isParagraph)
    .map(token => markdownToPlainText(token.text))
  const tag = paragraphs
    .map(paragraph => severityLine.exec(paragraph)?.[1])
    .find(match => match !== undefined)
  const body = paragraphs.filter(paragraph => !severityLine.test(paragraph))
  const headings = tokens
    .filter(isHeading)
    .map(token => markdownToPlainText(token.text))
  const heading = headings.find(label => !genericHeading.test(label)) ?? ''
  const lead = body[0] ?? markdownToPlainText(text)
  const title = truncate(heading || firstSentence(lead), 120)
  const rest = heading
    ? body.join(' ')
    : body.join(' ').slice(firstSentence(lead).length).trim()
  const summaryIndex = tokens.findIndex(
    token => isHeading(token) && /summary/i.test(token.text),
  )
  const summaryToken = tokens.slice(summaryIndex + 1).find(isParagraph)
  const summaryText =
    summaryIndex >= 0 && summaryToken
      ? summaryToken.text
      : `${title} ${body[0] ?? ''}`
  const findingsIndex = tokens.findIndex(
    token => isHeading(token) && /finding/i.test(token.text),
  )
  const findingsList = tokens.slice(findingsIndex + 1).find(isList)
  const level = levelOf(summaryText)
  return {
    title,
    preview: truncate(rest, findingPreviewLength),
    severity:
      status === 'Failed'
        ? 'Error'
        : tag
          ? severityOf(tag.toLowerCase())
          : level === 'error'
            ? 'Error'
            : level === 'warn'
              ? 'Warning'
              : 'Info',
    findings:
      findingsIndex >= 0 && findingsList ? findingsList.items.length : 0,
    tables: tokens.filter(token => token.type === 'table').length,
  }
}

export const summarizeFinding = (
  text: string,
  status?: string,
): FindingSummary => {
  const key = `${status ?? ''}\u0000${text}`
  const cached = summaries.get(key)
  if (cached) {
    return cached
  }
  if (summaries.size > 200) {
    summaries.clear()
  }
  const summary = summarize(text, status)
  summaries.set(key, summary)
  return summary
}
