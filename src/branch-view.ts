import type { Html, HtmlBuilder } from 'foldkit/html'

import { branchChanges, branchConflicts } from './branches'
import { idLink, linkifyIds } from './id-link'
import type { Model } from './main'
import { Message } from './message'
import { pageHeading } from './title-block'

const plusIcon = (h: HtmlBuilder<Message>): Html =>
  h.span([
    h.Class('icon'),
    h.AriaHidden(true),
    h.InnerHTML(
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>',
    ),
  ])

export const branchesPage = (model: Model, h: HtmlBuilder<Message>): Html =>
  h.div(
    [],
    [
      pageHeading(
        'Branches',
        'Each proposed change lives on a branch. Compare diffs, check impact, and merge into Base when reviewed.',
        h.button(
          [
            h.Type('button'),
            h.Class('button primary'),
            h.OnClick(Message.ClickedNewBranch()),
          ],
          [plusIcon(h), 'New branch'],
        ),
        h,
      ),
      h.div(
        [h.Class('simulation-notice')],
        [
          'Branches isolate edits locally. Baseline conflicts and pending reviews block merges. This preview has one local reviewer; production identity and permissions are not enforced.',
        ],
      ),
      h.div(
        [h.Class('branch-list')],
        model.workspace.branches.length
          ? model.workspace.branches.map(branch => {
              const changes = branchChanges(branch)
              const conflicts = branchConflicts(
                branch,
                model.workspace.requirements,
              )
              return h.keyed('article')(
                branch.id,
                [h.Class('panel branch-card')],
                [
                  h.div(
                    [h.Class('panel-heading')],
                    [
                      h.div(
                        [],
                        [
                          h.p(
                            [h.Class('mono small-text')],
                            [branch.id, ' · ', branch.status],
                          ),
                          h.h2([], [branch.title]),
                          h.p(
                            [],
                            [
                              `${changes.length} changed artifacts${branch.status === 'Draft' && conflicts.length ? ` · ${conflicts.length} conflicts` : ''}`,
                            ],
                          ),
                        ],
                      ),
                      branch.status === 'Draft'
                        ? h.div(
                            [h.Class('run-controls')],
                            [
                              h.button(
                                [
                                  h.Type('button'),
                                  h.Class('button outline small'),
                                  h.OnClick(
                                    Message.SelectedBranch({ id: branch.id }),
                                  ),
                                ],
                                ['Work on branch'],
                              ),
                              h.button(
                                [
                                  h.Type('button'),
                                  h.Class('button primary small'),
                                  h.Disabled(
                                    changes.length === 0 ||
                                      conflicts.length > 0 ||
                                      branch.reviewStatus !== 'Approved',
                                  ),
                                  h.OnClick(
                                    Message.ClickedMergeBranch({
                                      id: branch.id,
                                    }),
                                  ),
                                ],
                                ['Merge into Base'],
                              ),
                            ],
                          )
                        : h.span([h.Class('badge')], ['Merged']),
                    ],
                  ),
                  branch.status === 'Draft' && changes.length > 0
                    ? h.div(
                        [h.Class('branch-review')],
                        [
                          h.div(
                            [],
                            [
                              h.strong([], ['Workspace owner review']),
                              h.p(
                                [h.Class('muted small-text')],
                                [
                                  `${branch.reviewStatus} · local decision · new edits reset approval`,
                                ],
                              ),
                            ],
                          ),
                          h.button(
                            [
                              h.Type('button'),
                              h.Class('button outline small'),
                              h.OnClick(
                                Message.DecidedBranchReview({
                                  id: branch.id,
                                  reviewStatus: 'Rejected',
                                }),
                              ),
                            ],
                            ['Request changes'],
                          ),
                          h.button(
                            [
                              h.Type('button'),
                              h.Class('button primary small'),
                              h.Disabled(
                                conflicts.length > 0 ||
                                  branch.reviewStatus === 'Approved',
                              ),
                              h.OnClick(
                                Message.DecidedBranchReview({
                                  id: branch.id,
                                  reviewStatus: 'Approved',
                                }),
                              ),
                            ],
                            ['Approve branch'],
                          ),
                        ],
                      )
                    : h.empty,
                  changes.length
                    ? h.div(
                        [h.Class('branch-diffs')],
                        changes.map(item => {
                          const original = branch.base.find(
                            base => base.id === item.id,
                          )
                          return h.keyed('details')(
                            item.id,
                            [
                              h.Class(
                                `branch-diff ${conflicts.some(conflict => conflict.id === item.id) && branch.status === 'Draft' ? 'conflict' : ''}`,
                              ),
                            ],
                            [
                              h.summary(
                                [],
                                [
                                  idLink(model, item.id, h, 'mono'),
                                  ' · ',
                                  item.title,
                                  conflicts.some(
                                    conflict => conflict.id === item.id,
                                  ) && branch.status === 'Draft'
                                    ? ' · Conflict: Base also changed'
                                    : '',
                                ],
                              ),
                              h.div(
                                [h.Class('diff-columns')],
                                [
                                  h.div(
                                    [h.Class('diff-before')],
                                    [
                                      h.p([h.Class('eyebrow')], ['BEFORE']),
                                      h.strong(
                                        [],
                                        [original?.title ?? 'New artifact'],
                                      ),
                                      h.p(
                                        [],
                                        [
                                          original?.description ??
                                            'Not in the branch baseline',
                                        ],
                                      ),
                                      h.p(
                                        [h.Class('small-text mono')],
                                        [
                                          `${original?.kind ?? '—'} · ${original?.status ?? '—'} · ${original?.owner ?? '—'}`,
                                        ],
                                      ),
                                      h.p(
                                        [h.Class('small-text mono')],
                                        [
                                          `Links: ${original?.links.join(', ') || 'none'}`,
                                        ],
                                      ),
                                    ],
                                  ),
                                  h.div(
                                    [h.Class('diff-after')],
                                    [
                                      h.p([h.Class('eyebrow')], ['PROPOSED']),
                                      h.strong([], [item.title]),
                                      h.p(
                                        [],
                                        linkifyIds(model, item.description, h),
                                      ),
                                      h.p(
                                        [h.Class('small-text mono')],
                                        [
                                          `${item.kind} · ${item.status} · ${item.owner}`,
                                        ],
                                      ),
                                      h.p(
                                        [h.Class('small-text mono')],
                                        [
                                          `Links: ${item.links.join(', ') || 'none'}`,
                                        ],
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                              h.button(
                                [
                                  h.Type('button'),
                                  h.Class('button outline small'),
                                  h.OnClick(
                                    Message.SelectedBranch({ id: branch.id }),
                                  ),
                                ],
                                [
                                  'Select branch to inspect impact or run agents',
                                ],
                              ),
                            ],
                          )
                        }),
                      )
                    : h.p(
                        [h.Class('branch-empty')],
                        [
                          'No changes yet. Select this branch, then edit or add artifacts in Requirements.',
                        ],
                      ),
                ],
              )
            })
          : [
              h.div(
                [h.Class('empty-state panel')],
                [
                  h.h2([], ['No draft branches']),
                  h.p(
                    [],
                    [
                      'Create a branch to explore a change without modifying Base.',
                    ],
                  ),
                  h.button(
                    [
                      h.Type('button'),
                      h.Class('button outline'),
                      h.OnClick(Message.ClickedNewBranch()),
                    ],
                    [plusIcon(h), 'New branch'],
                  ),
                ],
              ),
            ],
      ),
    ],
  )
