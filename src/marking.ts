import type { Html, HtmlBuilder } from 'foldkit/html'

import type { Requirement } from './domain'

export const systemHigh = 'SECRET//NOFORN'
export const enclaveName = 'ATLAS-S'

export type Portion = 'U' | 'CUI' | 'S//NF'

const kindPortion: Record<Requirement['kind'], Portion> = {
  Requirement: 'CUI',
  System: 'U',
  Function: 'CUI',
  Design: 'S//NF',
  Test: 'CUI',
  Interface: 'S//NF',
  Risk: 'S//NF',
}

export const artifactPortion = (item: Pick<Requirement, 'kind'>): Portion =>
  kindPortion[item.kind]

export const findingPortion: Portion = 'S//NF'

export const portionText = (portion: Portion): string => `(${portion})`

export const portionTag = <M>(portion: Portion, h: HtmlBuilder<M>): Html =>
  h.span(
    [h.Class(`portion-mark ${portion === 'S//NF' ? 'secret' : ''}`)],
    [portionText(portion)],
  )
