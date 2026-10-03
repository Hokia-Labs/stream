import type { Html, HtmlBuilder } from 'foldkit/html'

import { ArtifactView, type Requirement } from './domain'
import type { Model } from './main'
import { Message } from './message'

const chevronIcon = (h: H): Html =>
  h.span([
    h.Class('icon'),
    h.AriaHidden(true),
    h.InnerHTML(
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"><path d="m9 5 7 7-7 7"/></svg>',
    ),
  ])

type H = HtmlBuilder<Message>
type TreeRow = { item: Requirement; ancestors: ReadonlyArray<string> }

export const artifactTree = (
  items: ReadonlyArray<Requirement>,
): ReadonlyArray<TreeRow> => {
  const visited = new Set<string>()
  const rows: Array<TreeRow> = []
  const walk = (item: Requirement, ancestors: ReadonlyArray<string>): void => {
    if (visited.has(item.id)) {
      return
    }
    visited.add(item.id)
    rows.push({ item, ancestors })
    item.links.forEach(id => {
      const child = items.find(candidate => candidate.id === id)
      if (child) {
        walk(child, ancestors.concat(item.id))
      }
    })
  }
  items
    .filter(item => !items.some(parent => parent.links.includes(item.id)))
    .forEach(item => walk(item, []))
  items.forEach(item => walk(item, []))
  return rows
}

export const artifactViewSwitcher = (model: Model, h: H): Html =>
  h.div(
    [h.Class('artifact-view-switcher'), h.AriaLabel('Artifact views')],
    ArtifactView.literals.map(artifactView =>
      h.keyed('button')(
        artifactView,
        [
          h.Type('button'),
          h.Class(
            `view-tab ${model.artifactView === artifactView ? 'selected' : ''}`,
          ),
          h.AriaPressed(String(model.artifactView === artifactView)),
          h.OnClick(Message.SelectedArtifactView({ artifactView })),
        ],
        [artifactView],
      ),
    ),
  )

export const artifactTreeView = (
  model: Model,
  items: ReadonlyArray<Requirement>,
  h: H,
): Html =>
  h.div(
    [h.Class('artifact-tree'), h.AriaLabel('Artifact hierarchy')],
    artifactTree(model.workspace.requirements)
      .filter(
        row =>
          items.some(item => item.id === row.item.id) &&
          (model.search.length > 0 ||
            !row.ancestors.some(id => model.collapsedArtifactIds.includes(id))),
      )
      .map(row =>
        h.keyed('div')(
          row.item.id,
          [
            h.Class('artifact-tree-row'),
            h.Style({ paddingLeft: `${16 + row.ancestors.length * 22}px` }),
          ],
          [
            row.item.links.length > 0
              ? h.button(
                  [
                    h.Type('button'),
                    h.Class('tree-expander'),
                    h.AriaLabel(`Toggle ${row.item.title}`),
                    h.AriaExpanded(
                      !model.collapsedArtifactIds.includes(row.item.id),
                    ),
                    h.OnClick(
                      Message.ToggledArtifactGroup({ id: row.item.id }),
                    ),
                  ],
                  [chevronIcon(h)],
                )
              : h.span([h.Class('tree-spacer')]),
            h.button(
              [
                h.Type('button'),
                h.Class('artifact-button tree-title'),
                h.OnClick(Message.SelectedNode({ id: row.item.id })),
              ],
              [
                h.span([h.Class('mono muted')], [row.item.id]),
                h.strong([], [row.item.title]),
              ],
            ),
            h.span([h.Class('type-label')], [row.item.kind]),
            h.span([h.Class('muted small-text')], [row.item.status]),
          ],
        ),
      ),
  )

export const artifactReaderView = (
  items: ReadonlyArray<Requirement>,
  h: H,
): Html =>
  h.div(
    [h.Class('artifact-reader'), h.AriaLabel('Artifact reader')],
    items.map(item =>
      h.keyed('article')(
        item.id,
        [h.Class('reader-artifact')],
        [
          h.div(
            [h.Class('reader-metadata')],
            [
              h.span([h.Class('mono')], [item.id]),
              h.span([], [item.kind]),
              h.span([], [item.status]),
              h.span([], [item.owner]),
              h.span([h.Class('mono')], [`r${item.revision}`]),
            ],
          ),
          h.h2([], [item.title]),
          h.p([h.Class('reader-description')], [item.description]),
          h.div(
            [h.Class('reader-links')],
            item.links.map(id =>
              h.keyed('button')(
                id,
                [
                  h.Type('button'),
                  h.Class('inspector-link'),
                  h.OnClick(Message.SelectedNode({ id })),
                ],
                [id],
              ),
            ),
          ),
          h.button(
            [
              h.Type('button'),
              h.Class('button outline small'),
              h.OnClick(Message.ClickedEditRequirement({ id: item.id })),
            ],
            ['Edit artifact'],
          ),
        ],
      ),
    ),
  )
