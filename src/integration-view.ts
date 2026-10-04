import type { Html, HtmlBuilder } from 'foldkit/html'

import {
  type DoorsRow,
  type JiraStatus,
  type JiraTicket,
  doorsModule,
} from './integrations'
import type { Message } from './message'

type H = HtmlBuilder<Message>

const filePaths: Readonly<Record<string, string>> = {
  'System Requirement':
    '<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4M9 12h7M9 16h7"/>',
  'Interface Requirement':
    '<path d="M4 12h5M15 12h5"/><rect x="9" y="8" width="6" height="8" rx="1"/><path d="M11 5v3M13 5v3M11 16v3M13 16v3"/>',
  'System Description':
    '<path d="M12 3 3 8l9 5 9-5z"/><path d="m3 13 9 5 9-5"/>',
  UGMASTER:
    '<path d="M12 3 4 7.5v9L12 21l8-4.5v-9z"/><path d="M4 7.5 12 12l8-4.5M12 12v9"/>',
  DirectModel:
    '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="2.5"/>',
  'BOMView Revision':
    '<rect x="9" y="3" width="6" height="4" rx="1"/><rect x="3" y="17" width="6" height="4" rx="1"/><rect x="15" y="17" width="6" height="4" rx="1"/><path d="M12 7v5M6 17v-5h12v5"/>',
  'Xpedition Design':
    '<rect x="7" y="7" width="10" height="10" rx="1"/><path d="M10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4"/>',
  PDF: '<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4"/><path d="M9 17v-4h1.5a1.5 1.5 0 0 1 0 3H9"/>',
  'LTspice Schematic': '<path d="M2 12h4l2-4 3 8 3-8 3 8 2-4h3"/>',
  'CAE Analysis':
    '<path d="M10 14V5a2 2 0 0 1 4 0v9"/><circle cx="12" cy="17" r="3"/><path d="M12 9v5"/>',
}

const syncInfo: Readonly<
  Record<string, Readonly<{ tone: string; path: string; detail: string }>>
> = {
  'In sync': {
    tone: 'ok',
    path: '<circle cx="12" cy="12" r="9"/><path d="m8 12.5 2.5 2.5L16 9.5"/>',
    detail: 'The Stream copy matches the latest revision in the source system.',
  },
  'Change set pending': {
    tone: 'pending',
    path: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    detail:
      'Stream has a newer revision than DOORS. The edits are held in a change set that has not been pushed back yet.',
  },
  'Check-in pending': {
    tone: 'pending',
    path: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    detail:
      'Stream has a new revision of this dataset that has not been checked in to Teamcenter yet.',
  },
  'Awaiting EE approval': {
    tone: 'pending',
    path: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    detail:
      'Proposed by the agent. It is checked in to Teamcenter only after the electrical engineer approves it.',
  },
}

export const syncStatus = (state: string, h: H): Html => {
  const info = syncInfo[state] ?? syncInfo['In sync']
  return h.span(
    [
      h.Class(`sync-icon ${info?.tone ?? 'ok'}`),
      h.Tabindex(0),
      h.AriaLabel(state),
    ],
    [
      h.span([
        h.Class('icon'),
        h.AriaHidden(true),
        h.InnerHTML(
          `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${info?.path ?? ''}</svg>`,
        ),
      ]),
      h.span(
        [h.Class('sync-pop'), h.Role('tooltip')],
        [h.strong([], [state]), h.span([], [info?.detail ?? ''])],
      ),
    ],
  )
}

export const fileIcon = (type: string, h: H): Html =>
  h.span([
    h.Class('icon file-icon'),
    h.AriaHidden(true),
    h.InnerHTML(
      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">${filePaths[type] ?? '<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4"/>'}</svg>`,
    ),
  ])

export const doorsLogo = (h: H): Html =>
  h.span(
    [h.Class('doors-logo'), h.AriaLabel('IBM DOORS')],
    [
      h.img([h.Src('/ibm-logo.svg'), h.Alt(''), h.Class('ibm-logo')]),
      h.span([], ['DOORS']),
    ],
  )

const brandLockup = (
  src: string,
  product: string,
  h: H,
  markClass = 'vendor-mark',
): Html =>
  h.span(
    [h.Class('doors-logo'), h.AriaLabel(product)],
    [h.img([h.Src(src), h.Alt(''), h.Class(markClass)]), h.span([], [product])],
  )

export const xpeditionLogo = (h: H): Html =>
  brandLockup('/siemens-logo.svg', 'Xpedition', h)

export const ltspiceLogo = (h: H): Html =>
  brandLockup('/adi-logo.svg', 'LTspice', h, 'adi-logo')

export const ansysLogo = (h: H): Html =>
  h.img([h.Src('/ansys-logo.svg'), h.Alt('Ansys'), h.Class('ansys-logo')])

export const toolHead = (logo: Html, meta: ReadonlyArray<string>, h: H): Html =>
  h.div(
    [h.Class('tool-head')],
    [
      syncedWith([logo], h),
      h.ul(
        [h.Class('tool-meta')],
        meta.map(item => h.keyed('li')(item, [], [item])),
      ),
    ],
  )

export const jiraLogo = (h: H): Html =>
  h.img([h.Src('/jira-logo.svg'), h.Alt('Jira'), h.Class('jira-logo')])

export const syncedWith = (logos: ReadonlyArray<Html>, h: H): Html =>
  h.div(
    [h.Class('tc-lockup')],
    [
      h.div(
        [h.Class('tc-brand')],
        [
          h.span([h.Class('muted')], ['Synced with']),
          ...logos.flatMap((logo, index) =>
            index === 0
              ? [logo]
              : [
                  h.span([h.Class('sync-sep'), h.AriaHidden(true)], ['·']),
                  logo,
                ],
          ),
        ],
      ),
    ],
  )

const jiraTone = (status: JiraStatus): string =>
  status === 'Done' ? 'ok' : status === 'In Review' ? 'pending' : 'closed'

export const jiraChip = (ticket: JiraTicket, h: H): Html =>
  h.span(
    [
      h.Class('jira-chip'),
      h.AriaLabel(
        `Jira ${ticket.key}, ${ticket.status}, assigned to ${ticket.assignee}`,
      ),
    ],
    [
      h.img([h.Src('/jira-icon.svg'), h.Alt(''), h.Class('jira-icon')]),
      h.span([h.Class('mono')], [ticket.key]),
      h.span(
        [h.Class(`jira-status ${jiraTone(ticket.status)}`)],
        [ticket.status],
      ),
      h.span([h.Class('muted')], [ticket.assignee]),
    ],
  )

export const jiraPanel = (tickets: ReadonlyArray<JiraTicket>, h: H): Html =>
  h.section(
    [h.Class('panel sync-panel'), h.AriaLabel('Jira hand-offs')],
    [
      h.table(
        [h.Class('sync-table')],
        [
          h.thead(
            [],
            [
              h.tr(
                [],
                ['Key', 'Summary', 'Assignee', 'Reporter', 'Status'].map(
                  label => h.th([], [label]),
                ),
              ),
            ],
          ),
          h.tbody(
            [],
            tickets.map(ticket =>
              h.keyed('tr')(
                ticket.key,
                [],
                [
                  h.td(
                    [],
                    [
                      h.span(
                        [h.Class('jira-key')],
                        [
                          h.img([
                            h.Src('/jira-icon.svg'),
                            h.Alt(''),
                            h.Class('jira-icon'),
                          ]),
                          h.span([h.Class('mono')], [ticket.key]),
                        ],
                      ),
                    ],
                  ),
                  h.td([], [ticket.summary]),
                  h.td([], [ticket.assignee]),
                  h.td([h.Class('muted')], [ticket.reporter]),
                  h.td(
                    [],
                    [
                      h.span(
                        [h.Class(`jira-status ${jiraTone(ticket.status)}`)],
                        [ticket.status],
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    ],
  )

export const doorsPanel = (rows: ReadonlyArray<DoorsRow>, h: H): Html => {
  const changed = rows.filter(row => row.state !== 'In sync').length
  return h.section(
    [h.Class('panel sync-panel'), h.AriaLabel('DOORS module')],
    [
      h.table(
        [h.Class('sync-table')],
        [
          h.thead(
            [],
            [
              h.tr(
                [],
                ['Type', 'Requirement', 'DOORS', 'Stream', 'Status'].map(
                  label => h.th([], [label]),
                ),
              ),
            ],
          ),
          h.tbody(
            [],
            [
              h.tr(
                [h.Class('sync-group')],
                [
                  h.th(
                    [h.Colspan(4)],
                    [
                      h.span([h.Class('mono')], [doorsModule.id]),
                      h.span(
                        [h.Class('muted')],
                        [
                          ` · ${doorsModule.title} · baseline ${doorsModule.baseline}`,
                        ],
                      ),
                    ],
                  ),
                  h.th(
                    [],
                    [
                      h.span(
                        [
                          h.Class(
                            `sync-state ${changed > 0 ? 'pending' : 'ok'}`,
                          ),
                        ],
                        [
                          changed > 0
                            ? `${changed} of ${rows.length} changed`
                            : `${rows.length} in sync`,
                        ],
                      ),
                    ],
                  ),
                ],
              ),
              ...rows.map(row =>
                h.keyed('tr')(
                  row.id,
                  [],
                  [
                    h.td(
                      [h.Class('sync-file muted')],
                      [fileIcon(row.type, h), row.type],
                    ),
                    h.td(
                      [],
                      [
                        h.span([h.Class('mono muted')], [`${row.id} `]),
                        row.title,
                      ],
                    ),
                    h.td([h.Class('mono')], [`${row.doorsId} · ${row.doors}`]),
                    h.td([h.Class('mono')], [`${row.id}/${row.stream}`]),
                    h.td(
                      [h.Class('sync-status-cell')],
                      [syncStatus(row.state, h)],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    ],
  )
}
