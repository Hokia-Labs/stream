import type { Html, HtmlBuilder } from 'foldkit/html'

import type { Model } from './main'
import { Message } from './message'

export const idTarget = (model: Model, id: string): Message | undefined =>
  model.workspace.requirements.some(item => item.id === id)
    ? Message.OpenedArtifact({ id })
    : model.workspace.runs.some(run => run.id === id)
      ? Message.SelectedRun({ id })
      : model.workspace.agents.some(agent => agent.id === id)
        ? Message.OpenedAgent({ id })
        : undefined

export const idLink = (
  model: Model,
  id: string,
  h: HtmlBuilder<Message>,
  className = '',
): Html => {
  const target = idTarget(model, id)
  return target
    ? h.button(
        [
          h.Type('button'),
          h.Class(`meta-link ${className}`.trim()),
          h.OnClick(target),
        ],
        [id],
      )
    : h.span(className ? [h.Class(className)] : [], [id])
}

const idPattern = /\b[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+\b/g

export const linkifyIds = (
  model: Model,
  text: string,
  h: HtmlBuilder<Message>,
): ReadonlyArray<Html | string> =>
  text
    .split(new RegExp(`(${idPattern.source})`, 'g'))
    .map((part, index) =>
      index % 2 === 1 && idTarget(model, part) ? idLink(model, part, h) : part,
    )
