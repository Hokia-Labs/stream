import type { Html, HtmlBuilder } from 'foldkit/html'

import type { Page } from './domain'
import type { Message } from './message'

export const pageHeading = (
  page: Page,
  subtitle: string,
  action: Html,
  h: HtmlBuilder<Message>,
): Html =>
  h.div(
    [h.Class('page-heading')],
    [
      h.div(
        [h.Class('page-title')],
        [h.h1([], [page]), h.p([h.Class('subtitle')], [subtitle])],
      ),
      action,
    ],
  )
