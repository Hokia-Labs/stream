import type { Html, HtmlBuilder } from 'foldkit/html'

import {
  type DoorsRow,
  type JiraStatus,
  type JiraTicket,
  doorsModule,
} from './integrations'
import type { Message } from './message'

type H = HtmlBuilder<Message>

export const doorsLogo = (h: H): Html =>
  h.span(
    [h.Class('doors-logo'), h.AriaLabel('IBM DOORS Next')],
    [
      h.img([h.Src('/ibm-logo.svg'), h.Alt(''), h.Class('ibm-logo')]),
      h.span([], ['DOORS Next']),
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
    [h.Class('panel sync-panel'), h.AriaLabel('DOORS Next module')],
    [
      h.table(
        [h.Class('sync-table')],
        [
          h.thead(
            [],
            [
              h.tr(
                [],
                ['Requirement', 'Type', 'DOORS Next', 'Stream', 'Status'].map(
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
                      [h.Class('sync-file')],
                      [
                        h.span([h.Class('mono muted')], [`${row.id} `]),
                        row.title,
                      ],
                    ),
                    h.td([h.Class('muted')], [row.type]),
                    h.td([h.Class('mono')], [`${row.doorsId} · ${row.doors}`]),
                    h.td([h.Class('mono')], [`${row.id}/${row.stream}`]),
                    h.td(
                      [],
                      [
                        h.span(
                          [
                            h.Class(
                              `sync-state ${row.state === 'In sync' ? 'ok' : 'pending'}`,
                            ),
                          ],
                          [row.state],
                        ),
                      ],
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
