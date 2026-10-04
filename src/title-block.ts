import type { Html, HtmlBuilder } from 'foldkit/html'

import type { Page } from './domain'
import type { Message } from './message'

export const pageHeading = (
  page: Page,
  subtitle: string,
  action: Html,
  h: HtmlBuilder<Message>,
  sync?: Html,
): Html =>
  h.div(
    [h.Class('page-heading')],
    [
      h.div(
        [h.Class('page-title')],
        [
          sync
            ? h.div([h.Class('page-title-row')], [h.h1([], [page]), sync])
            : h.h1([], [page]),
          subtitle ? h.p([h.Class('subtitle')], [subtitle]) : h.empty,
        ],
      ),
      action,
    ],
  )
