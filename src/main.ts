import { Array, Effect, Option, Order, Schema, Stream } from 'effect'
import { Command, Dom, type Runtime, Subscription, type Update } from 'foldkit'
import * as FoldkitFile from 'foldkit/file'
import { modifyFields } from 'foldkit/struct'

import { visibleArtifacts } from './artifact-order'
import { agentDesign, isEngineerDesign } from './board-review'
import {
  branchChanges,
  branchConflicts,
  mergeRequirements,
  workingRequirements,
  writeRequirements,
} from './branches'
import { do254Files } from './do254'
import type { Agent, Branch, Run } from './domain'
import {
  ArtifactField,
  ArtifactKind,
  ArtifactView,
  CloudflareAiMode,
  CloudflareTest,
  Execution,
  ExecutionMode,
  GraphPreviewTab,
  GraphScope,
  GraphView,
  GroupBy,
  Modal,
  Page,
  Requirement,
  ReviewDecision,
  Run as RunSchema,
  RunView,
  SortDirection,
  SortKey,
  TaskSession,
  TwinCheck,
  TwinDesignChange,
  TwinFocus,
  TwinPackage,
  TwinPanelTab,
  TwinPdrUpload,
  TwinProposal,
  TwinReport,
  TwinReportSync,
  TwinReviewItem,
  Workspace,
  agentOutput,
  seedWorkspace,
  validCloudflareAccountId,
  validCloudflareToken,
} from './domain'
import { ExecutorStatus } from './executor'
import { findingTasks, findingText, launchScopeRequirements } from './insights'
import {
  clampSidebarWidth,
  clampTreeHeight,
  sidebarDefaultWidth,
  sidebarMaxWidth,
  sidebarMinWidth,
  sidebarWidthKey,
  treeDefaultHeight,
  treeMaxHeight,
  treeMinHeight,
} from './layout'
import { Message } from './message'
import { pageShortcuts, paletteItems } from './palette'
import {
  avionicsRequirementIds,
  catalogBlocker,
  derivedArtifacts,
  hasTwinScenario,
  installTwinRevision,
  isAvionicsUpgraded,
  proposalPartChanges,
  proposalReviewer,
  requirementChecks,
  seedTwinArtifacts,
  signoffTitle,
  stampHrdSignoff,
  suggestedPart,
  swapTwinAvionics,
  twinCatalog,
  twinChanges,
  twinPackageFiles,
  twinRevision,
} from './twin'
import { createZip } from './zip'

export { Message } from './message'
export { view } from './view'

// MODEL

export const Model = Schema.Struct({
  workspace: Workspace,
  page: Page,
  artifactView: ArtifactView,
  collapsedArtifactIds: Schema.Array(Schema.String),
  visibleArtifactFields: Schema.Array(ArtifactField),
  search: Schema.String,
  filter: Schema.String,
  maybeSelectedNode: Schema.Option(Schema.String),
  maybeGraphPan: Schema.Option(
    Schema.Struct({ x: Schema.Number, y: Schema.Number }),
  ),
  didPanGraph: Schema.Boolean,
  maybeSelectedRun: Schema.Option(Schema.String),
  maybeActiveBranch: Schema.Option(Schema.String),
  modal: Modal,
  maybeToast: Schema.Option(Schema.String),
  isToastError: Schema.Boolean,
  hasInvalidSubmit: Schema.Boolean,
  maybeLeavingToast: Schema.Option(
    Schema.Struct({ text: Schema.String, token: Schema.Number }),
  ),
  maybeClosingNode: Schema.Option(
    Schema.Struct({ id: Schema.String, token: Schema.Number }),
  ),
  maybeClosingModal: Schema.Option(
    Schema.Struct({ modal: Modal, token: Schema.Number }),
  ),
  motionToken: Schema.Number,
  maybeOpenFinding: Schema.Option(
    Schema.Struct({ runId: Schema.String, agentId: Schema.String }),
  ),
  maybeClosingFinding: Schema.Option(
    Schema.Struct({
      runId: Schema.String,
      agentId: Schema.String,
      token: Schema.Number,
    }),
  ),
  isFindingSourceShown: Schema.Boolean,
  runFilter: Schema.Literals(['All', 'Running', 'Failed', 'Review']),
  storage: Schema.Literals(['Loading', 'Ready', 'Unavailable']),
  executionMode: ExecutionMode,
  maybeExecutorStatus: Schema.Option(ExecutorStatus),
  maybeExecutorError: Schema.Option(Schema.String),
  graphZoom: Schema.Number,
  maybeSortKey: Schema.Option(SortKey),
  sortDirection: SortDirection,
  selectedArtifactIds: Schema.Array(Schema.String),
  maybeSelectedAgent: Schema.Option(Schema.String),
  isSidebarCollapsed: Schema.Boolean,
  runView: RunView,
  runLogQuery: Schema.String,
  viewedApprovalIds: Schema.Array(Schema.String),
  stagedDecisions: Schema.Array(ReviewDecision),
  groupBy: GroupBy,
  collapsedGroups: Schema.Array(Schema.String),
  pauseAfter: Schema.Array(Schema.Number),
  graphPreviewTab: GraphPreviewTab,
  graphView: GraphView,
  graphScope: GraphScope,
  graphQuery: Schema.String,
  hiddenGraphKinds: Schema.Array(ArtifactKind),
  isMatrixGapsOnly: Schema.Boolean,
  isSetupDismissed: Schema.Boolean,
  sidebarTreeHeight: Schema.Number,
  maybeTreeDrag: Schema.Option(
    Schema.Struct({
      startHeight: Schema.Number,
      maybeStartY: Schema.Option(Schema.Number),
    }),
  ),
  isWorkspaceMenuOpen: Schema.Boolean,
  isUserMenuOpen: Schema.Boolean,
  hasAcknowledgedConsent: Schema.Boolean,
  hasLoadedNavigation: Schema.Boolean,
  sidebarWidth: Schema.Number,
  isResizingSidebar: Schema.Boolean,
  twinFocus: TwinFocus,
  twinPanelTab: TwinPanelTab,
  twinReviewed: Schema.Array(TwinReviewItem),
  twinProposal: TwinProposal,
  twinCheck: TwinCheck,
  twinDesign: Schema.Array(TwinDesignChange),
  maybeTwinPdr: Schema.Option(TwinPdrUpload),
  maybeTwinPackage: Schema.Option(TwinPackage),
  twinReports: Schema.Array(TwinReport),
  twinReportTab: Schema.String,
  twinReportSync: TwinReportSync,
  twinReportSaveToken: Schema.Number,
  isGeneratingTwinPackage: Schema.Boolean,
  cloudflareAccountId: Schema.String,
  cloudflareTokenDraft: Schema.String,
  hasStoredCloudflareToken: Schema.Boolean,
  cloudflareAiMode: CloudflareAiMode,
  maybeCloudflareTest: Schema.Option(CloudflareTest),
})
export type Model = typeof Model.Type
type UpdateReturn = Update.Return<Model, Message>
export const initialModel: Model = {
  workspace: seedWorkspace,
  page: 'Files',
  artifactView: 'Table',
  collapsedArtifactIds: [],
  visibleArtifactFields: ArtifactField.literals,
  search: '',
  filter: 'All artifacts',
  maybeSelectedNode: Option.none(),
  maybeGraphPan: Option.none(),
  didPanGraph: false,
  maybeSelectedRun: Option.none(),
  maybeActiveBranch: Option.none(),
  modal: Modal.Closed(),
  maybeToast: Option.none(),
  isToastError: false,
  hasInvalidSubmit: false,
  maybeLeavingToast: Option.none(),
  maybeClosingNode: Option.none(),
  maybeClosingModal: Option.none(),
  motionToken: 0,
  maybeOpenFinding: Option.none(),
  maybeClosingFinding: Option.none(),
  isFindingSourceShown: false,
  runFilter: 'All',
  storage: 'Loading',
  executionMode: 'Cloudflare',
  maybeExecutorStatus: Option.none(),
  maybeExecutorError: Option.none(),
  graphZoom: 1,
  maybeSortKey: Option.none(),
  sortDirection: 'Ascending',
  selectedArtifactIds: [],
  maybeSelectedAgent: Option.none(),
  isSidebarCollapsed: false,
  runView: 'Matrix',
  runLogQuery: '',
  viewedApprovalIds: [],
  stagedDecisions: [],
  groupBy: 'None',
  collapsedGroups: [],
  pauseAfter: [],
  graphPreviewTab: 'Output',
  graphView: 'Graph',
  graphScope: 'All',
  graphQuery: '',
  hiddenGraphKinds: [],
  isMatrixGapsOnly: false,
  isSetupDismissed: false,
  sidebarTreeHeight: treeDefaultHeight,
  maybeTreeDrag: Option.none(),
  isWorkspaceMenuOpen: false,
  isUserMenuOpen: false,
  hasAcknowledgedConsent: false,
  hasLoadedNavigation: false,
  sidebarWidth: 232,
  isResizingSidebar: false,
  twinFocus: 'Airframe',
  twinPanelTab: 'Change',
  twinReviewed: [],
  twinProposal: 'None',
  twinCheck: 'Not run',
  twinDesign: agentDesign,
  maybeTwinPdr: Option.none(),
  maybeTwinPackage: Option.none(),
  twinReports: [],
  twinReportTab: '',
  twinReportSync: 'Local',
  twinReportSaveToken: 0,
  isGeneratingTwinPackage: false,
  cloudflareAccountId: '3d275686d20e190931adbada39b35957',
  cloudflareTokenDraft: '',
  hasStoredCloudflareToken: false,
  cloudflareAiMode: 'Unknown',
  maybeCloudflareTest: Option.none(),
}

export const cloudflareCredentialsKey = 'stream.cloudflare-ai.v1'
const StoredCloudflareCredentials = Schema.Struct({
  accountId: Schema.String,
  token: Schema.String,
})

// COMMAND

export const storageKey = 'stream.workspace.v1'
export const legacyStorageKey = 'relay.workspace.v1'
const recoverWorkspace = (workspace: Workspace): Workspace =>
  modifyFields(workspace, {
    runs: runs =>
      runs.map(run =>
        run.status === 'Running'
          ? modifyFields(run, {
              status: () => 'Paused',
              token: token => token + 1,
            })
          : run,
      ),
  })
export const LoadWorkspace = Command.define('LoadWorkspace', {
  messages: [Message.CompletedLoadWorkspace, Message.FailedLoadWorkspace],
  execute: Effect.try(() => {
    const saved =
      localStorage.getItem(storageKey) ?? localStorage.getItem(legacyStorageKey)
    const workspace = saved
      ? Schema.decodeUnknownSync(Workspace)(JSON.parse(saved))
      : seedWorkspace
    const recovered = recoverWorkspace(workspace)
    return Message.CompletedLoadWorkspace({
      workspace: recovered,
      restored: Boolean(saved),
    })
  }).pipe(
    Effect.catch(() =>
      Effect.succeed(
        Message.FailedLoadWorkspace({
          error:
            'Saved workspace could not be read. Sample data is shown; export your work before leaving.',
        }),
      ),
    ),
  ),
})
export const SaveWorkspace = Command.define('SaveWorkspace', {
  args: { workspace: Workspace },
  messages: [Message.CompletedSaveWorkspace, Message.FailedSaveWorkspace],
  execute: ({ workspace }) =>
    Effect.try(() => {
      localStorage.setItem(storageKey, JSON.stringify(workspace))
      return Message.CompletedSaveWorkspace()
    }).pipe(
      Effect.catch(() =>
        Effect.succeed(
          Message.FailedSaveWorkspace({
            error:
              'Browser storage is unavailable. Your changes are in memory only; export them before leaving.',
          }),
        ),
      ),
    ),
})
const navigationKey = 'stream.navigation.v1'
const Navigation = Schema.Struct({ page: Page, scrollTop: Schema.Number })
const nextFrame = () =>
  new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
export const LoadNavigation = Command.define('LoadNavigation', {
  messages: [Message.LoadedNavigation],
  execute: Effect.try(() => {
    history.scrollRestoration = 'manual'
    const saved = sessionStorage.getItem(navigationKey)
    return Message.LoadedNavigation(
      saved
        ? Schema.decodeUnknownSync(Navigation)(JSON.parse(saved))
        : { page: initialModel.page, scrollTop: 0 },
    )
  }).pipe(
    Effect.catch(() =>
      Effect.succeed(
        Message.LoadedNavigation({ page: initialModel.page, scrollTop: 0 }),
      ),
    ),
  ),
})
const saveNavigation = (page: Page) =>
  Effect.promise(() => nextFrame().then(nextFrame)).pipe(
    Effect.andThen(() =>
      Effect.try(() =>
        sessionStorage.setItem(
          navigationKey,
          JSON.stringify({ page, scrollTop: Math.round(window.scrollY) }),
        ),
      ),
    ),
    Effect.ignore,
    Effect.as(Message.CompletedSaveNavigation()),
  )
export const RestoreScroll = Command.define('RestoreScroll', {
  args: { top: Schema.Number },
  messages: [Message.CompletedRestoreScroll],
  execute: ({ top }) =>
    Effect.promise(
      () =>
        new Promise<void>(resolve => {
          const attempt = (frame: number) => {
            const isTallEnough =
              document.documentElement.scrollHeight - window.innerHeight >= top
            if (isTallEnough || frame >= 90) {
              window.scrollTo({ top, behavior: 'instant' })
              resolve()
              return
            }
            requestAnimationFrame(() => attempt(frame + 1))
          }
          requestAnimationFrame(() => attempt(0))
        }),
    ).pipe(Effect.as(Message.CompletedRestoreScroll())),
})
export const LoadSidebarWidth = Command.define('LoadSidebarWidth', {
  messages: [Message.LoadedSidebarWidth],
  execute: Effect.try(() => {
    const saved = Number(localStorage.getItem(sidebarWidthKey))
    return Message.LoadedSidebarWidth({
      width:
        Number.isFinite(saved) && saved > 0
          ? clampSidebarWidth(saved)
          : sidebarDefaultWidth,
    })
  }).pipe(
    Effect.catch(() =>
      Effect.succeed(
        Message.LoadedSidebarWidth({ width: sidebarDefaultWidth }),
      ),
    ),
  ),
})
export const SaveSidebarWidth = Command.define('SaveSidebarWidth', {
  args: { width: Schema.Number },
  messages: [Message.CompletedSaveSidebarWidth],
  execute: ({ width }) =>
    Effect.try(() => {
      localStorage.setItem(sidebarWidthKey, String(width))
      return Message.CompletedSaveSidebarWidth()
    }).pipe(
      Effect.catch(() => Effect.succeed(Message.CompletedSaveSidebarWidth())),
    ),
})
export const WaitForSimulationWave = Command.define('WaitForSimulationWave', {
  args: { id: Schema.String, token: Schema.Number },
  messages: [Message.CompletedSimulationWave],
  execute: ({ id, token }) =>
    Effect.sleep('1800 millis').pipe(
      Effect.as(Message.CompletedSimulationWave({ id, token })),
    ),
})
const readCloudflareCredentials = () => {
  const saved = localStorage.getItem(cloudflareCredentialsKey)
  const data: unknown = saved ? JSON.parse(saved) : undefined
  return Schema.is(StoredCloudflareCredentials)(data)
    ? Option.some(data)
    : Option.none()
}
const LocalAiStatus = Schema.Struct({
  mode: Schema.Literals(['Mock', 'WorkersAI']),
})
export const SyncCloudflareCredentials = Command.define(
  'SyncCloudflareCredentials',
  {
    args: {
      operation: Schema.Literals(['Load', 'Save', 'Forget']),
      accountId: Schema.String,
      token: Schema.String,
    },
    messages: [Message.LoadedCloudflareCredentials],
    execute: ({ operation, accountId, token }) =>
      Effect.tryPromise(async () => {
        if (operation === 'Save') {
          localStorage.setItem(
            cloudflareCredentialsKey,
            JSON.stringify({
              accountId: accountId.trim(),
              token: token.trim(),
            }),
          )
        }
        if (operation === 'Forget') {
          localStorage.removeItem(cloudflareCredentialsKey)
        }
        const stored = readCloudflareCredentials()
        const nextAccountId = Option.match(stored, {
          onNone: () => accountId,
          onSome: credentials => credentials.accountId,
        })
        const mode = await fetch('/api/local/ai-credentials', {
          method: Option.isSome(stored) ? 'POST' : 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          signal: AbortSignal.timeout(10_000),
          ...Option.match(stored, {
            onNone: () => ({}),
            onSome: credentials => ({ body: JSON.stringify(credentials) }),
          }),
        })
          .then(async (response): Promise<CloudflareAiMode> => {
            if (response.status === 401) {
              return 'Locked'
            }
            if (!response.ok) {
              return 'Unavailable'
            }
            const data: unknown = await response.json()
            return Schema.is(LocalAiStatus)(data) ? data.mode : 'Unavailable'
          })
          .catch((): CloudflareAiMode => 'Unavailable')
        return Message.LoadedCloudflareCredentials({
          accountId: nextAccountId,
          hasToken: Option.isSome(stored),
          mode,
        })
      }).pipe(
        Effect.catch(() =>
          Effect.succeed(
            Message.LoadedCloudflareCredentials({
              accountId,
              hasToken: false,
              mode: 'Unavailable',
            }),
          ),
        ),
      ),
  },
)
const LocalAiTest = Schema.Struct({
  ok: Schema.Boolean,
  detail: Schema.String,
  latencyMs: Schema.Number,
})
export const TestCloudflareCredentials = Command.define(
  'TestCloudflareCredentials',
  {
    args: { accountId: Schema.String, token: Schema.String },
    messages: [Message.CompletedCloudflareTest],
    execute: ({ accountId, token }) =>
      Effect.tryPromise(async () => {
        const response = await fetch('/api/local/ai-test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          signal: AbortSignal.timeout(75_000),
          body: JSON.stringify({
            accountId: accountId.trim(),
            token: token.trim(),
          }),
        })
        if (response.status === 401) {
          return Message.CompletedCloudflareTest({
            ok: false,
            latencyMs: 0,
            detail:
              'Unlock Stream first (username stream, local access token).',
          })
        }
        const data: unknown = await response.json()
        return Message.CompletedCloudflareTest(
          Schema.decodeUnknownSync(LocalAiTest)(data),
        )
      }).pipe(
        Effect.catch(() =>
          Effect.succeed(
            Message.CompletedCloudflareTest({
              ok: false,
              latencyMs: 0,
              detail:
                'No local backend answered. Start Stream with bun run dev:local.',
            }),
          ),
        ),
      ),
  },
)
export const ProbeExecutor = Command.define('ProbeExecutor', {
  messages: [Message.CompletedProbeExecutor, Message.FailedProbeExecutor],
  execute: Effect.tryPromise(async () => {
    const response = await fetch('/api/executor', {
      signal: AbortSignal.timeout(10_000),
      credentials: 'same-origin',
    })
    if (!response.ok) {
      throw new Error('Cloudflare Worker is not available.')
    }
    const data: unknown = await response.json()
    return Message.CompletedProbeExecutor({
      status: Schema.decodeUnknownSync(ExecutorStatus)(data),
    })
  }).pipe(
    Effect.catch(() =>
      Effect.succeed(
        Message.FailedProbeExecutor({
          error:
            'Cloudflare backend not reachable. Switch to Simulation or set it up in Settings.',
        }),
      ),
    ),
  ),
})
export const PrepareCloudflareRun = Command.define('PrepareCloudflareRun', {
  args: { id: Schema.String, token: Schema.Number },
  messages: [
    Message.CompletedPrepareCloudflareRun,
    Message.FailedPrepareCloudflareRun,
  ],
  execute: ({ id, token }) =>
    Effect.try(() =>
      Message.CompletedPrepareCloudflareRun({
        id,
        token,
        runId: crypto.randomUUID(),
      }),
    ).pipe(
      Effect.catch(() =>
        Effect.succeed(Message.FailedPrepareCloudflareRun({ id, token })),
      ),
    ),
})
export const SyncCloudflareRun = Command.define('SyncCloudflareRun', {
  args: {
    run: RunSchema,
    workspace: Workspace,
    operation: Schema.Literals(['Start', 'Poll', 'Hold', 'Resume', 'Cancel']),
  },
  messages: [
    Message.CompletedSyncCloudflareRun,
    Message.CompletedPendingCloudflareRun,
    Message.FailedSyncCloudflareRun,
  ],
  execute: ({ run, workspace, operation }) =>
    Effect.tryPromise(async () => {
      if (run.execution._tag !== 'Cloudflare') {
        throw new Error('No durable run identifier.')
      }
      if (operation === 'Start') {
        localStorage.setItem(storageKey, JSON.stringify(workspace))
      }
      const path = `/api/runs/${run.execution.runId}${['Hold', 'Resume', 'Cancel'].includes(operation) ? '/control' : ''}`
      const response = await fetch(path, {
        method: operation === 'Poll' ? 'GET' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        signal: AbortSignal.timeout(30_000),
        ...(operation === 'Poll'
          ? {}
          : { body: JSON.stringify(operation === 'Start' ? run : operation) }),
      })
      if (!response.ok) {
        throw new Error('Executor request failed.')
      }
      const data: unknown = await response.json()
      if (Schema.is(Schema.Struct({ pending: Schema.Literal(true) }))(data)) {
        return Message.CompletedPendingCloudflareRun({
          id: run.id,
          token: run.token,
        })
      }
      return Message.CompletedSyncCloudflareRun({
        id: run.id,
        token: run.token,
        run: Schema.decodeUnknownSync(RunSchema)(data),
      })
    }).pipe(
      Effect.catch(() =>
        Effect.succeed(
          Message.FailedSyncCloudflareRun({
            id: run.id,
            token: run.token,
            error:
              'Connection lost or access denied. The durable run may still be working. Unlock the Worker, then reconnect or retry cancellation; a tab reload does not stop agents.',
          }),
        ),
      ),
      effect =>
        operation === 'Poll'
          ? Effect.sleep('3 seconds').pipe(Effect.andThen(effect))
          : effect,
    ),
})
const ExportWorkspace = Command.define('ExportWorkspace', {
  args: { workspace: Workspace },
  messages: [Message.CompletedExport, Message.FailedExport],
  execute: ({ workspace }) =>
    Effect.try(() => {
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(workspace, null, 2)], {
          type: 'application/json',
        }),
      )
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = 'stream-workspace.json'
      anchor.click()
      URL.revokeObjectURL(url)
      return Message.CompletedExport()
    }).pipe(
      Effect.catch(() =>
        Effect.succeed(
          Message.FailedExport({ error: 'Export failed. Please try again.' }),
        ),
      ),
    ),
})

const sha256 = async (data: Uint8Array<ArrayBuffer>): Promise<string> => {
  const hash = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(hash)]
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('')
}
const LoadTwinReports = Command.define('LoadTwinReports', {
  messages: [Message.LoadedTwinReports],
  execute: Effect.tryPromise(async () => {
    const response = await fetch('/api/reports', {
      signal: AbortSignal.timeout(10_000),
      credentials: 'same-origin',
    })
    if (!response.ok) {
      throw new Error('Report store unavailable.')
    }
    const data: unknown = await response.json()
    return Message.LoadedTwinReports(
      Schema.decodeUnknownSync(
        Schema.Struct({ files: Schema.Array(TwinReport) }),
      )(data),
    )
  }).pipe(
    Effect.catch(() =>
      Effect.succeed(Message.LoadedTwinReports({ files: [] })),
    ),
  ),
})

const WaitTwinReportSave = Command.define('WaitTwinReportSave', {
  args: { token: Schema.Number },
  messages: [Message.ElapsedTwinReportSave],
  execute: ({ token }) =>
    Effect.sleep('700 millis').pipe(
      Effect.as(Message.ElapsedTwinReportSave({ token })),
    ),
})

const WaitTwinProposal = Command.define('WaitTwinProposal', {
  messages: [Message.DraftedTwinProposal],
  execute: Effect.sleep('1600 millis').pipe(
    Effect.as(Message.DraftedTwinProposal()),
  ),
})

const isTextFile = (file: File): boolean =>
  FoldkitFile.mimeType(file).startsWith('text/') ||
  /\.(md|markdown|txt|csv)$/i.test(FoldkitFile.name(file))

const ReadTwinPdr = Command.define('ReadTwinPdr', {
  args: { file: FoldkitFile.File },
  messages: [Message.LoadedTwinPdr, Message.FailedLoadTwinPdr],
  execute: ({ file }) =>
    (isTextFile(file)
      ? FoldkitFile.readAsText(file).pipe(
          Effect.map(text => Option.some(text.slice(0, 200_000))),
        )
      : Effect.succeed(Option.none<string>())
    ).pipe(
      Effect.map(maybeText =>
        Message.LoadedTwinPdr({
          upload: {
            name: FoldkitFile.name(file),
            size: FoldkitFile.size(file),
            maybeText,
          },
        }),
      ),
      Effect.catch(() =>
        Effect.succeed(
          Message.FailedLoadTwinPdr({ name: FoldkitFile.name(file) }),
        ),
      ),
    ),
})

const WaitTwinCheck = Command.define('WaitTwinCheck', {
  messages: [Message.CompletedTwinCheck],
  execute: Effect.sleep('1200 millis').pipe(
    Effect.as(Message.CompletedTwinCheck()),
  ),
})

const SaveTwinReports = Command.define('SaveTwinReports', {
  args: { files: Schema.Array(TwinReport), token: Schema.Number },
  messages: [Message.SavedTwinReports, Message.FailedSaveTwinReports],
  execute: ({ files, token }) =>
    Effect.tryPromise(async () => {
      const response = await fetch('/api/reports', {
        method: 'PUT',
        signal: AbortSignal.timeout(10_000),
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(files),
      })
      if (!response.ok) {
        throw new Error('Report store rejected the save.')
      }
      return Message.SavedTwinReports({ token })
    }).pipe(
      Effect.catch(() =>
        Effect.succeed(Message.FailedSaveTwinReports({ token })),
      ),
    ),
})

const DraftTwinReports = Command.define('DraftTwinReports', {
  args: {
    requirements: Schema.Array(Requirement),
  },
  messages: [Message.DraftedTwinReports],
  execute: ({ requirements }) =>
    Effect.sync(() => {
      const date = new Date().toISOString().slice(0, 10)
      return Message.DraftedTwinReports({
        files: [
          ...twinPackageFiles(requirements, date),
          ...do254Files(requirements, date),
        ].map(file => ({
          name: file.name,
          content: file.content,
          isEdited: false,
        })),
      })
    }),
})

const BuildTwinPackage = Command.define('BuildTwinPackage', {
  args: {
    files: Schema.Array(TwinReport),
    reviewed: Schema.Array(TwinReviewItem),
  },
  messages: [Message.GeneratedTwinPackage, Message.FailedTwinPackage],
  execute: ({ files, reviewed }) =>
    Effect.tryPromise(async () => {
      const now = new Date()
      const encoder = new TextEncoder()
      const entries = files.map(file => ({
        name: file.name,
        data: encoder.encode(file.content),
        isEdited: file.isEdited,
      }))
      const hashes = await Promise.all(
        entries.map(async entry => ({
          name: entry.name,
          bytes: entry.data.length,
          sha256: await sha256(entry.data),
          editedInStream: entry.isEdited,
        })),
      )
      const manifest = encoder.encode(
        JSON.stringify(
          {
            generatedBy: 'Stream',
            generatedAt: now.toISOString(),
            signedOff: reviewed.map(item => ({
              discipline: signoffTitle(item),
              by: 'Dakota Edwards',
            })),
            files: hashes,
          },
          null,
          2,
        ),
      )
      const archive = createZip(
        [
          ...entries.map(entry => ({ name: entry.name, data: entry.data })),
          { name: 'manifest.json', data: manifest },
        ],
        now,
      )
      const digest = await sha256(archive)
      const name = `${(files[0]?.name ?? 'HRD.md').replace(/\.md$/, '')}-package.zip`
      const url = URL.createObjectURL(
        new Blob([archive], { type: 'application/zip' }),
      )
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = name
      anchor.click()
      URL.revokeObjectURL(url)
      return Message.GeneratedTwinPackage({
        name,
        digest,
        bytes: archive.length,
        files: files.map(file => file.name).concat(['manifest.json']),
      })
    }).pipe(
      Effect.catch(() =>
        Effect.succeed(
          Message.FailedTwinPackage({
            error: 'Packaging failed. Please try again.',
          }),
        ),
      ),
    ),
})

// UPDATE

const exitSelectors = {
  Toast: '.toast[data-state="leaving"]',
  Inspector: '.inspector[data-state="closing"]',
  Modal: '.modal-backdrop[data-state="closing"]',
  Finding: '.finding-drawer[data-state="closing"]',
} as const

type ExitSurface = keyof typeof exitSelectors

const settleExit = (surface: ExitSurface, token: number) =>
  Effect.promise(
    () => new Promise<void>(resolve => requestAnimationFrame(() => resolve())),
  ).pipe(
    Effect.andThen(() => Dom.waitForAnimationSettled(exitSelectors[surface])),
    Effect.catch(() => Effect.void),
    Effect.as(Message.CompletedExitMotion({ surface, token })),
  )

const exitToken = (maybe: Option.Option<{ readonly token: number }>): number =>
  Option.match(maybe, { onNone: () => -1, onSome: exit => exit.token })

// Overlays that close on the same page keep rendering in a closing state until
// their exit animation settles (see the exit subscriptions). Page changes are covered by the page view transition.
const withExitMotion = (
  previous: Model,
  result: UpdateReturn,
): UpdateReturn => {
  const next = result.model
  const samePage = previous.page === next.page
  const toastLeft =
    samePage &&
    Option.isSome(previous.maybeToast) &&
    Option.isNone(next.maybeToast)
  const nodeClosed =
    samePage &&
    Option.isSome(previous.maybeSelectedNode) &&
    Option.isNone(next.maybeSelectedNode)
  const modalClosed =
    samePage && previous.modal._tag !== 'Closed' && next.modal._tag === 'Closed'
  const findingClosed =
    samePage &&
    Option.isSome(previous.maybeOpenFinding) &&
    Option.isNone(next.maybeOpenFinding)
  const findingLeftPage = !samePage && Option.isSome(next.maybeOpenFinding)
  const hasExit = toastLeft || nodeClosed || modalClosed || findingClosed
  const hasClosing =
    Option.isSome(next.maybeLeavingToast) ||
    Option.isSome(next.maybeClosingNode) ||
    Option.isSome(next.maybeClosingModal) ||
    Option.isSome(next.maybeClosingFinding)
  if (!hasExit && !hasClosing && !findingLeftPage) {
    return result
  }
  const toastToken = next.motionToken + 1
  const nodeToken = next.motionToken + 2
  const modalToken = next.motionToken + 3
  const findingToken = next.motionToken + 4
  const model = modifyFields(next, {
    motionToken: token => (hasExit ? token + 4 : token),
    maybeOpenFinding: open => (samePage ? open : Option.none()),
    maybeClosingFinding: closing =>
      Option.isSome(next.maybeOpenFinding) || !samePage
        ? Option.none()
        : findingClosed
          ? Option.map(previous.maybeOpenFinding, open => ({
              ...open,
              token: findingToken,
            }))
          : closing,
    maybeLeavingToast: leaving =>
      Option.isSome(next.maybeToast)
        ? Option.none()
        : toastLeft
          ? Option.map(previous.maybeToast, text => ({
              text,
              token: toastToken,
            }))
          : leaving,
    maybeClosingNode: closing =>
      Option.isSome(next.maybeSelectedNode) || !samePage
        ? Option.none()
        : nodeClosed
          ? Option.map(previous.maybeSelectedNode, id => ({
              id,
              token: nodeToken,
            }))
          : closing,
    maybeClosingModal: closing =>
      next.modal._tag !== 'Closed' || !samePage
        ? Option.none()
        : modalClosed
          ? Option.some({ modal: previous.modal, token: modalToken })
          : closing,
  })
  return { ...result, model }
}

export const update = (model: Model, message: Message): UpdateReturn => {
  const result = withExitMotion(model, updateMessage(model, message))
  return result.model.hasInvalidSubmit &&
    result.model.modal._tag !== model.modal._tag
    ? {
        ...result,
        model: modifyFields(result.model, { hasInvalidSubmit: () => false }),
      }
    : result
}

const pendingApprovals = (model: Model): number =>
  model.workspace.approvals.filter(approval => approval.status === 'Pending')
    .length

export const motionTransition = (
  previous: Model,
  model: Model,
): false | { readonly types: ReadonlyArray<string> } => {
  if (previous.page !== model.page) {
    return { types: ['page'] }
  }
  if (
    !hasTwinScenario(previous.workspace.requirements) &&
    hasTwinScenario(model.workspace.requirements)
  ) {
    return { types: ['page'] }
  }
  if (
    (previous.selectedArtifactIds.length === 0) !==
    (model.selectedArtifactIds.length === 0)
  ) {
    return { types: ['bulk-bar'] }
  }
  if (pendingApprovals(model) < pendingApprovals(previous)) {
    return { types: ['approvals'] }
  }
  if (
    Option.isSome(previous.maybeSelectedNode) &&
    Option.isSome(model.maybeSelectedNode) &&
    previous.maybeSelectedNode.value !== model.maybeSelectedNode.value
  ) {
    return { types: ['inspector-swap'] }
  }
  return false
}

const PanGraph = Command.define('PanGraph', {
  args: { dx: Schema.Number, dy: Schema.Number },
  messages: [Message.CompletedPanGraph],
  execute: ({ dx, dy }) =>
    Effect.try(() => {
      document.querySelector('.graph-page .graph-scroll')?.scrollBy(dx, dy)
    }).pipe(
      Effect.catch(() => Effect.void),
      Effect.as(Message.CompletedPanGraph()),
    ),
})

const inspectorWidth = 340
const RevealGraphNode = Command.define('RevealGraphNode', {
  args: { id: Schema.String },
  messages: [Message.CompletedRevealGraphNode],
  execute: ({ id }) =>
    Effect.tryPromise(async () => {
      await new Promise<void>(resolve =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      )
      const plane = document.querySelector('.graph-page .graph-plane')
      if (plane) {
        await Promise.allSettled(
          plane.getAnimations().map(animation => animation.finished),
        )
      }
      const viewport = document.querySelector('.graph-page .graph-scroll')
      const node = viewport?.querySelector(`[data-node-id="${CSS.escape(id)}"]`)
      if (!viewport || !node) {
        return
      }
      const view = viewport.getBoundingClientRect()
      const box = node.getBoundingClientRect()
      const margin = 24
      const visibleRight = Math.min(
        view.right,
        window.innerWidth - inspectorWidth,
      )
      const left =
        box.right + margin > visibleRight
          ? box.right + margin - visibleRight
          : box.left - margin < view.left
            ? box.left - margin - view.left
            : 0
      const legend = viewport
        .closest('.graph-page')
        ?.querySelector('.legend')
        ?.getBoundingClientRect()
      const visibleTop = Math.max(view.top, 0)
      const visibleBottom = Math.min(
        view.bottom,
        legend && legend.top > view.top ? legend.top : view.bottom,
        window.innerHeight,
      )
      const isVerticallyVisible =
        box.top - margin >= visibleTop && box.bottom + margin <= visibleBottom
      const top = isVerticallyVisible
        ? 0
        : (box.top + box.bottom) / 2 - (visibleTop + visibleBottom) / 2
      const isReducedMotion = window.matchMedia(
        '(prefers-reduced-motion: reduce)',
      ).matches
      const revealInPage = () =>
        node.scrollIntoView({
          block: 'nearest',
          inline: 'nearest',
          behavior: isReducedMotion ? 'instant' : 'smooth',
        })
      if (left === 0 && top === 0) {
        revealInPage()
        return
      }
      if (isReducedMotion) {
        viewport.scrollBy({ left, top })
        revealInPage()
        return
      }
      const startLeft = viewport.scrollLeft
      const startTop = viewport.scrollTop
      const duration = 260
      const start = performance.now()
      await new Promise<void>(resolve => {
        const step = (now: number) => {
          const progress = Math.min(1, (now - start) / duration)
          const eased = 1 - (1 - progress) ** 3
          viewport.scrollTo(startLeft + left * eased, startTop + top * eased)
          if (progress < 1) {
            requestAnimationFrame(step)
          } else {
            resolve()
          }
        }
        requestAnimationFrame(step)
      })
      revealInPage()
    }).pipe(
      Effect.catch(() => Effect.void),
      Effect.as(Message.CompletedRevealGraphNode()),
    ),
})

export const ScrollActiveNav = Command.define('ScrollActiveNav', {
  messages: [Message.CompletedScrollActiveNav],
  execute: Effect.promise(
    () =>
      new Promise<void>(resolve =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  ).pipe(
    Effect.andThen(() =>
      Effect.try(() => {
        if (window.innerWidth > 760) {
          return
        }
        document
          .querySelector('.sidebar nav .nav-item.active')
          ?.scrollIntoView({ inline: 'nearest', block: 'nearest' })
      }),
    ),
    Effect.catch(() => Effect.void),
    Effect.as(Message.CompletedScrollActiveNav()),
  ),
})
const FocusFinding = Command.define('FocusFinding', {
  messages: [Message.CompletedFocusFinding],
  execute: Dom.focus('#finding-title', { makeFocusable: true }).pipe(
    Effect.catch(() => Effect.void),
    Effect.as(Message.CompletedFocusFinding()),
  ),
})

const CopyFinding = Command.define('CopyFinding', {
  args: { text: Schema.String },
  messages: [Message.CompletedCopyFinding, Message.FailedCopyFinding],
  execute: ({ text }) =>
    Effect.tryPromise(() => navigator.clipboard.writeText(text)).pipe(
      Effect.as(Message.CompletedCopyFinding()),
      Effect.catch(() => Effect.succeed(Message.FailedCopyFinding())),
    ),
})

const FocusPalette = Command.define('FocusPalette', {
  messages: [Message.CompletedFocusPalette],
  execute: Dom.focus('#palette-input').pipe(
    Effect.catch(() => Effect.void),
    Effect.as(Message.CompletedFocusPalette()),
  ),
})

const persist = (
  model: Model,
  workspace: Workspace,
  notification?: string,
): UpdateReturn => ({
  model: modifyFields(model, {
    workspace: () => workspace,
    maybeToast: toast => (notification ? Option.some(notification) : toast),
    isToastError: isError => (notification ? false : isError),
  }),
  commands: [SaveWorkspace({ workspace })],
})
const notify = (model: Model, text: string): UpdateReturn => ({
  model: modifyFields(model, {
    maybeToast: () => Option.some(text),
    isToastError: () => false,
  }),
})
const notifyError = (model: Model, text: string): UpdateReturn => ({
  model: modifyFields(model, {
    maybeToast: () => Option.some(text),
    isToastError: () => true,
  }),
})
const replaceRun = (workspace: Workspace, run: Run): Workspace =>
  modifyFields(workspace, {
    runs: runs => runs.map(item => (item.id === run.id ? run : item)),
  })
const record = (workspace: Workspace, event: string): Workspace =>
  modifyFields(workspace, { events: events => [event, ...events].slice(0, 60) })

const controlCloudflare = (
  model: Model,
  run: Run,
  operation: 'Hold' | 'Resume' | 'Cancel',
): UpdateReturn => {
  const nextRun = modifyFields(run, {
    token: token => token + 1,
    status: () =>
      operation === 'Cancel'
        ? 'Cancelling'
        : operation === 'Hold'
          ? 'Paused'
          : 'Running',
  })
  const result = persist(
    model,
    record(
      replaceRun(model.workspace, nextRun),
      `${run.id} · ${operation.toLowerCase()} requested from Pi`,
    ),
  )
  return {
    model: result.model,
    commands: [
      ...(result.commands ?? []),
      SyncCloudflareRun({
        run: nextRun,
        workspace: result.model.workspace,
        operation,
      }),
    ],
  }
}

const updateMessage = (model: Model, message: Message): UpdateReturn =>
  Message.match<UpdateReturn>(message, {
    CompletedExitMotion: ({ surface, token }) => {
      const isCurrent = (maybe: Option.Option<{ readonly token: number }>) =>
        Option.exists(maybe, exit => exit.token === token)
      return {
        model: modifyFields(model, {
          maybeLeavingToast: leaving =>
            surface === 'Toast' && isCurrent(leaving) ? Option.none() : leaving,
          maybeClosingNode: closing =>
            surface === 'Inspector' && isCurrent(closing)
              ? Option.none()
              : closing,
          maybeClosingFinding: closing =>
            surface === 'Finding' && isCurrent(closing)
              ? Option.none()
              : closing,
          maybeClosingModal: closing =>
            surface === 'Modal' && isCurrent(closing) ? Option.none() : closing,
        }),
      }
    },
    ClickedArtifactFields: () => ({
      model: modifyFields(model, { modal: () => Modal.ArtifactFields() }),
    }),
    ToggledArtifactField: ({ field }) => ({
      model: modifyFields(model, {
        visibleArtifactFields: fields =>
          fields.includes(field)
            ? fields.filter(candidate => candidate !== field)
            : fields.concat(field),
      }),
    }),
    ClickedImport: () => ({
      model: modifyFields(model, {
        modal: () => Modal.WorkspaceImporter({ jsonText: '' }),
      }),
    }),
    UpdatedImportJson: ({ jsonText }) => ({
      model: modifyFields(model, {
        modal: modal =>
          modal._tag === 'WorkspaceImporter'
            ? modifyFields(modal, { jsonText: () => jsonText })
            : modal,
      }),
    }),
    SubmittedImport: () => {
      if (
        model.modal._tag !== 'WorkspaceImporter' ||
        model.storage === 'Loading'
      ) {
        return { model }
      }
      if (model.modal.jsonText.length > 2_000_000) {
        return notify(
          model,
          'Workspace import is limited to 2 MB in this local preview.',
        )
      }
      const workspace = Schema.decodeUnknownOption(
        Schema.fromJsonString(Workspace),
      )(model.modal.jsonText)
      if (Option.isNone(workspace)) {
        return notify(
          model,
          'Import rejected: paste a valid exported Stream workspace. Your current data is unchanged.',
        )
      }
      return persist(
        modifyFields(model, {
          modal: () => Modal.Closed(),
          maybeSelectedNode: () => Option.none(),
          maybeSelectedRun: () => Option.none(),
          maybeActiveBranch: () => Option.none(),
          search: () => '',
          filter: () => 'All artifacts',
          storage: () => 'Ready',
        }),
        record(
          recoverWorkspace(workspace.value),
          'Workspace imported from JSON · local workspace owner',
        ),
        'Workspace imported. Unfinished runs are paused until you resume them.',
      )
    },
    SelectedPage: ({ page }) => ({
      model: modifyFields(model, {
        page: () => page,
        search: () => '',
        filter: () => 'All artifacts',
        maybeSelectedNode: () => Option.none(),
      }),
      commands: [ScrollActiveNav()],
    }),
    LoadedNavigation: ({ page, scrollTop }) =>
      page === model.page && scrollTop === 0
        ? {
            model: modifyFields(model, { hasLoadedNavigation: () => true }),
          }
        : {
            model: modifyFields(model, {
              page: () => page,
              hasLoadedNavigation: () => true,
            }),
            commands: [RestoreScroll({ top: scrollTop })],
          },
    CompletedSaveNavigation: () => ({ model }),
    CompletedRestoreScroll: () => ({ model }),
    OpenedArtifact: ({ id }) => ({
      model: modifyFields(model, {
        page: () => 'Requirements',
        search: () => '',
        filter: () => 'All artifacts',
        maybeSelectedNode: () => Option.some(id),
      }),
      commands: [ScrollActiveNav()],
    }),
    OpenedAgent: ({ id }) => ({
      model: modifyFields(model, {
        page: () => 'Agent fleet',
        maybeSelectedAgent: () => Option.some(id),
      }),
      commands: [ScrollActiveNav()],
    }),
    SelectedInbox: () => ({
      model: modifyFields(model, {
        page: () => 'Inbox',
        search: () => '',
        filter: () => 'All artifacts',
        maybeSelectedNode: () => Option.none(),
      }),
    }),
    CompletedScrollActiveNav: () => ({ model }),
    UpdatedSearch: ({ value }) => ({
      model: modifyFields(model, { search: () => value }),
    }),
    SelectedArtifactView: ({ artifactView }) => ({
      model: modifyFields(model, { artifactView: () => artifactView }),
    }),
    ToggledArtifactGroup: ({ id }) => ({
      model: modifyFields(model, {
        collapsedArtifactIds: ids =>
          ids.includes(id)
            ? ids.filter(candidate => candidate !== id)
            : ids.concat(id),
      }),
    }),
    SelectedFilter: ({ value }) => ({
      model: modifyFields(model, { filter: () => value }),
    }),
    SelectedDisciplineView: ({ value }) => ({
      model: modifyFields(model, {
        page: () => 'Requirements',
        filter: () => value,
        maybeSelectedNode: () => Option.none(),
      }),
    }),
    SelectedNode: ({ id }) => ({
      model: modifyFields(model, { maybeSelectedNode: () => Option.some(id) }),
      ...(model.page === 'Systems graph'
        ? { commands: [RevealGraphNode({ id })] }
        : {}),
    }),
    ClosedInspector: () => ({
      model: modifyFields(model, { maybeSelectedNode: () => Option.none() }),
    }),
    PressedGraphCanvas: ({ x, y }) => ({
      model: modifyFields(model, {
        maybeGraphPan: () => Option.some({ x, y }),
        didPanGraph: () => false,
      }),
    }),
    MovedGraphPan: ({ x, y }) =>
      Option.match(model.maybeGraphPan, {
        onNone: () => ({ model }),
        onSome: start => {
          const dx = start.x - x
          const dy = start.y - y
          return {
            model: modifyFields(model, {
              maybeGraphPan: () => Option.some({ x, y }),
              didPanGraph: moved => moved || Math.abs(dx) + Math.abs(dy) > 2,
            }),
            commands: [PanGraph({ dx, dy })],
          }
        },
      }),
    ReleasedGraphPan: () => ({
      model: modifyFields(model, { maybeGraphPan: () => Option.none() }),
    }),
    ClickedGraphBackdrop: () => ({
      model: model.didPanGraph
        ? modifyFields(model, { didPanGraph: () => false })
        : modifyFields(model, { maybeSelectedNode: () => Option.none() }),
    }),
    CompletedPanGraph: () => ({ model }),

    AcknowledgedConsent: () => ({
      model: modifyFields(model, { hasAcknowledgedConsent: () => true }),
    }),
    SelectedRun: ({ id }) => ({
      model: modifyFields(model, {
        maybeSelectedRun: () => Option.some(id),
        page: () => 'Runs',
      }),
    }),
    ClickedNewBranch: () => ({
      model: modifyFields(model, {
        modal: () => Modal.BranchEditor({ title: '' }),
      }),
    }),
    SubmittedBranch: () => {
      if (model.modal._tag !== 'BranchEditor' || model.storage === 'Loading') {
        return { model }
      }
      if (!model.modal.title.trim()) {
        return notify(
          model,
          'Name your proposed change before creating a branch.',
        )
      }
      const branch: Branch = {
        id: `BR-${String(model.workspace.nextId).padStart(3, '0')}`,
        title: model.modal.title.trim(),
        status: 'Draft',
        base: model.workspace.requirements,
        reviewStatus: 'Pending',
        requirements: model.workspace.requirements,
      }
      return persist(
        modifyFields(model, {
          modal: () => Modal.Closed(),
          page: () => 'Requirements',
          maybeActiveBranch: () => Option.some(branch.id),
          maybeSelectedNode: () => Option.none(),
        }),
        record(
          modifyFields(model.workspace, {
            branches: branches => [branch, ...branches],
            nextId: nextId => nextId + 1,
          }),
          `${branch.id} created · ${branch.title}`,
        ),
        'Branch created. Your edits are isolated from Base.',
      )
    },
    SelectedBranch: ({ id }) => {
      if (
        id &&
        !model.workspace.branches.some(
          branch => branch.id === id && branch.status === 'Draft',
        )
      ) {
        return { model }
      }
      return {
        model: modifyFields(model, {
          maybeActiveBranch: () => (id ? Option.some(id) : Option.none()),
          maybeSelectedNode: () => Option.none(),
          search: () => '',
          filter: () => 'All artifacts',
        }),
      }
    },
    DecidedBranchReview: ({ id, reviewStatus }) => {
      const branch = model.workspace.branches.find(
        candidate => candidate.id === id && candidate.status === 'Draft',
      )
      if (!branch || !branchChanges(branch).length) {
        return { model }
      }
      return persist(
        model,
        record(
          modifyFields(model.workspace, {
            branches: branches =>
              branches.map(item =>
                item.id === id
                  ? modifyFields(item, { reviewStatus: () => reviewStatus })
                  : item,
              ),
          }),
          `${id} review ${reviewStatus.toLowerCase()} · local workspace owner`,
        ),
        reviewStatus === 'Approved'
          ? 'Branch approved for merge. Further edits require a new review.'
          : 'Changes requested. Update the branch before resubmitting.',
      )
    },
    ClickedMergeBranch: ({ id }) => {
      const branch = model.workspace.branches.find(
        candidate => candidate.id === id && candidate.status === 'Draft',
      )
      if (!branch) {
        return { model }
      }
      if (branchConflicts(branch, model.workspace.requirements).length) {
        return notify(
          model,
          'Merge blocked: Base changed the same artifacts. Resolve the highlighted conflicts first.',
        )
      }
      if (!branchChanges(branch).length) {
        return notify(
          model,
          'No changes to merge. Edit artifacts on the branch first.',
        )
      }
      if (branch.reviewStatus !== 'Approved') {
        return notify(
          model,
          'Merge blocked: the local workspace owner must approve these changes first.',
        )
      }
      const workspace = record(
        modifyFields(model.workspace, {
          requirements: requirements => mergeRequirements(branch, requirements),
          branches: branches =>
            branches.map(item =>
              item.id === id
                ? modifyFields(item, { status: () => 'Merged' })
                : item,
            ),
        }),
        `${branch.id} merged into Base · approved by local workspace owner`,
      )
      return persist(
        modifyFields(model, {
          maybeActiveBranch: active =>
            Option.isSome(active) && active.value === id
              ? Option.none()
              : active,
          maybeSelectedNode: () => Option.none(),
        }),
        workspace,
        'Changes reviewed and merged into Base. Historical runs are unchanged.',
      )
    },
    ClickedNewRequirement: () => ({
      model: modifyFields(model, {
        modal: () =>
          Modal.RequirementEditor({
            id: '',
            title: '',
            description: '',
            kind: 'Requirement',
            owner: 'Dakota Edwards',
            links: [],
          }),
      }),
    }),
    ClickedEditRequirement: ({ id }) => {
      const item = workingRequirements(model).find(
        candidate => candidate.id === id,
      )
      return item
        ? {
            model: modifyFields(model, {
              modal: () =>
                Modal.RequirementEditor({
                  id: item.id,
                  title: item.title,
                  description: item.description,
                  kind: item.kind,
                  owner: item.owner,
                  links: item.links,
                }),
            }),
          }
        : { model }
    },
    UpdatedTitle: ({ value }) => ({
      model: modifyFields(model, {
        modal: modal =>
          Modal.match(modal, {
            Closed: () => modal,
            ArtifactFields: () => modal,
            WorkspaceImporter: () => modal,
            RequirementEditor: editor =>
              modifyFields(editor, { title: () => value }),
            AgentEditor: editor => modifyFields(editor, { name: () => value }),
            RunLauncher: editor => modifyFields(editor, { title: () => value }),
            Settings: () => modal,
            BranchEditor: editor =>
              modifyFields(editor, { title: () => value }),
            CommandPalette: () => modal,
            Shortcuts: () => modal,
            PartPicker: () => modal,
            BoardReview: () => modal,
          }),
      }),
    }),
    UpdatedDescription: ({ value }) => ({
      model: modifyFields(model, {
        modal: modal =>
          modal._tag === 'RequirementEditor'
            ? modifyFields(modal, { description: () => value })
            : modal,
      }),
    }),
    UpdatedOwner: ({ value }) => ({
      model: modifyFields(model, {
        modal: modal =>
          modal._tag === 'RequirementEditor'
            ? modifyFields(modal, { owner: () => value })
            : modal,
      }),
    }),
    UpdatedKind: ({ value }) => ({
      model: modifyFields(model, {
        modal: modal => {
          const kind = Schema.decodeUnknownOption(Requirement.fields.kind)(
            value,
          )
          return modal._tag === 'RequirementEditor' && Option.isSome(kind)
            ? modifyFields(modal, { kind: () => kind.value })
            : modal
        },
      }),
    }),
    ToggledLink: ({ id }) => ({
      model: modifyFields(model, {
        modal: modal =>
          modal._tag === 'RequirementEditor' && id !== modal.id
            ? modifyFields(modal, {
                links: links =>
                  links.includes(id)
                    ? links.filter(link => link !== id)
                    : links.concat(id),
              })
            : modal,
      }),
    }),
    SubmittedRequirement: () => {
      if (model.modal._tag !== 'RequirementEditor') {
        return { model }
      }
      const editor = model.modal
      if (
        !editor.title.trim() ||
        !editor.description.trim() ||
        !editor.owner.trim()
      ) {
        return notify(
          modifyFields(model, { hasInvalidSubmit: () => true }),
          'Add a title, description, and owner before saving.',
        )
      }
      const requirements = workingRequirements(model)
      const existing = requirements.find(item => item.id === editor.id)
      const id =
        existing?.id ?? `ART-${String(model.workspace.nextId).padStart(3, '0')}`
      const item: Requirement = {
        id,
        title: editor.title.trim(),
        description: editor.description.trim(),
        kind: editor.kind,
        owner: editor.owner.trim(),
        links: editor.links.filter(
          link =>
            requirements.some(candidate => candidate.id === link) &&
            link !== id,
        ),
        revision: (existing?.revision ?? 0) + 1,
        status: 'Needs review',
      }
      const workspace = record(
        modifyFields(
          writeRequirements(
            model,
            existing
              ? requirements.map(current =>
                  current.id === id ? item : current,
                )
              : requirements.concat(item),
          ),
          {
            nextId: next => next + 1,
          },
        ),
        `${id} revision ${item.revision} saved · ${item.owner} · ${Option.getOrElse(model.maybeActiveBranch, () => 'Base')}`,
      )
      return persist(
        modifyFields(model, {
          modal: () => Modal.Closed(),
          maybeSelectedNode: () => Option.some(id),
        }),
        workspace,
        'Artifact saved. Run the fleet to analyze its impact.',
      )
    },
    ClickedNewAgent: () => ({
      model: modifyFields(model, {
        modal: () =>
          Modal.AgentEditor({ id: '', name: '', instructions: '', wave: 2 }),
      }),
    }),
    ClickedEditAgent: ({ id }) => {
      const agent = model.workspace.agents.find(item => item.id === id)
      return agent
        ? {
            model: modifyFields(model, {
              modal: () =>
                Modal.AgentEditor({
                  id: agent.id,
                  name: agent.name,
                  instructions: agent.instructions,
                  wave: agent.wave,
                }),
            }),
          }
        : { model }
    },
    UpdatedInstructions: ({ value }) => ({
      model: modifyFields(model, {
        modal: modal =>
          modal._tag === 'AgentEditor'
            ? modifyFields(modal, { instructions: () => value })
            : modal,
      }),
    }),
    SubmittedAgent: () => {
      if (model.modal._tag !== 'AgentEditor') {
        return { model }
      }
      const editor = model.modal
      if (!editor.name.trim() || !editor.instructions.trim()) {
        return notify(model, 'Give your agent a name and instructions.')
      }
      const existing = model.workspace.agents.find(
        item => item.id === editor.id,
      )
      const agent = existing
        ? modifyFields(existing, {
            name: () => editor.name.trim(),
            instructions: () => editor.instructions.trim(),
            wave: () => editor.wave,
          })
        : {
            id: `custom-${model.workspace.nextId}`,
            name: editor.name.trim(),
            instructions: editor.instructions.trim(),
            description: 'Your expertise, turned into a repeatable workflow.',
            category: 'Custom agent',
            enabled: true,
            wave: editor.wave,
            color: 'mint',
          }
      const workspace = record(
        modifyFields(model.workspace, {
          agents: agents =>
            existing
              ? agents.map(item => (item.id === agent.id ? agent : item))
              : agents.concat(agent),
          nextId: next => next + 1,
        }),
        `${agent.name} configuration saved`,
      )
      return persist(
        modifyFields(model, { modal: () => Modal.Closed() }),
        workspace,
        'Agent configuration saved. Simulation does not execute custom prompts.',
      )
    },
    ToggledAgent: ({ id }) =>
      persist(
        model,
        modifyFields(model.workspace, {
          agents: agents =>
            agents.map(agent =>
              agent.id === id
                ? modifyFields(agent, { enabled: enabled => !enabled })
                : agent,
            ),
        }),
      ),
    SelectedAgentWave: ({ wave }) => ({
      model: modifyFields(model, {
        modal: modal =>
          modal._tag === 'AgentEditor'
            ? modifyFields(modal, { wave: () => wave })
            : modal,
      }),
    }),
    ClickedLaunch: () => ({
      model: modifyFields(model, {
        modal: () =>
          Modal.RunLauncher({
            targetId: Option.getOrElse(
              model.maybeSelectedNode,
              () => 'REQ-001',
            ),
            title: 'Analyze change impact',
            scope: 'Workspace',
            launchAnother: false,
          }),
      }),
      ...(model.executionMode === 'Cloudflare'
        ? { commands: [ProbeExecutor()] }
        : {}),
    }),
    SelectedExecutionMode: ({ mode }) => ({
      model: modifyFields(model, {
        executionMode: () => mode,
        maybeToast: toast =>
          mode === 'Simulation' && model.isToastError ? Option.none() : toast,
      }),
      ...(mode === 'Cloudflare' ? { commands: [ProbeExecutor()] } : {}),
    }),
    ClickedProbeExecutor: () => ({ model, commands: [ProbeExecutor()] }),
    CompletedProbeExecutor: ({ status }) => ({
      model: modifyFields(model, {
        maybeExecutorStatus: () => Option.some(status),
        maybeExecutorError: () => Option.none(),
        maybeToast: toast =>
          model.isToastError && Option.isSome(model.maybeExecutorError)
            ? Option.none()
            : toast,
      }),
    }),
    FailedProbeExecutor: ({ error }) => {
      const failed = modifyFields(model, {
        maybeExecutorStatus: () => Option.none(),
        maybeExecutorError: () => Option.some(error),
      })
      return model.modal._tag === 'RunLauncher'
        ? { model: failed }
        : notifyError(failed, error)
    },
    CompletedPrepareCloudflareRun: ({ id, token, runId }) => {
      const run = model.workspace.runs.find(item => item.id === id)
      if (
        !run ||
        run.token !== token ||
        run.status !== 'Running' ||
        run.execution._tag !== 'Preparing'
      ) {
        return { model }
      }
      const prepared = modifyFields(run, {
        execution: () => Execution.Cloudflare({ runId }),
      })
      const result = persist(model, replaceRun(model.workspace, prepared))
      return {
        model: result.model,
        commands: [
          ...(result.commands ?? []),
          SyncCloudflareRun({
            run: prepared,
            workspace: result.model.workspace,
            operation: 'Start',
          }),
        ],
      }
    },
    FailedPrepareCloudflareRun: ({ id, token }) => {
      const run = model.workspace.runs.find(item => item.id === id)
      return run && run.token === token
        ? persist(
            model,
            replaceRun(
              model.workspace,
              modifyFields(run, { status: () => 'Failed' }),
            ),
            'Could not prepare a durable run identifier. No agents were dispatched.',
          )
        : { model }
    },
    CompletedSyncCloudflareRun: ({ id, token, run: remote }) => {
      const run = model.workspace.runs.find(item => item.id === id)
      if (
        !run ||
        run.token !== token ||
        run.execution._tag !== 'Cloudflare' ||
        remote.execution._tag !== 'Cloudflare' ||
        remote.execution.runId !== run.execution.runId ||
        remote.id !== id
      ) {
        return { model }
      }
      const synchronized = modifyFields(remote, { token: () => token + 1 })
      const completed =
        synchronized.status === 'Completed' &&
        !model.workspace.approvals.some(item => item.runId === id)
      const workspace = modifyFields(
        replaceRun(model.workspace, synchronized),
        {
          approvals: approvals =>
            completed
              ? approvals.concat({
                  id: `APR-${id}`,
                  title: `Review ${run.title.toLowerCase()}`,
                  detail: `Workers AI completed ${run.tasks.length} Pi agents. Findings are proposals only; review the evidence before editing or merging artifacts. No external write tools were exposed.`,
                  targetId: run.targetId,
                  agentId: 'review',
                  status: 'Pending',
                  runId: id,
                })
              : approvals,
        },
      )
      const result = persist(
        model,
        run.status !== synchronized.status || run.wave !== synchronized.wave
          ? record(
              workspace,
              `${id} · Workers AI stage ${synchronized.wave + 1} · ${synchronized.status.toLowerCase()}`,
            )
          : workspace,
        completed
          ? 'Fleet complete. Review the model findings before accepting changes.'
          : undefined,
      )
      return {
        model: result.model,
        commands: [
          ...(result.commands ?? []),
          ...(['Running', 'Paused', 'Cancelling'].includes(synchronized.status)
            ? [
                SyncCloudflareRun({
                  run: synchronized,
                  workspace,
                  operation: 'Poll',
                }),
              ]
            : []),
        ],
      }
    },
    FailedSyncCloudflareRun: ({ id, token, error }) => {
      const run = model.workspace.runs.find(item => item.id === id)
      return run && run.token === token
        ? persist(
            model,
            replaceRun(
              model.workspace,
              modifyFields(run, {
                status: status =>
                  status === 'Cancelling' ? 'Cancelling' : 'Paused',
                token: value => value + 1,
              }),
            ),
            error,
          )
        : { model }
    },
    CompletedPendingCloudflareRun: ({ id, token }) => {
      const run = model.workspace.runs.find(item => item.id === id)
      return run && run.token === token
        ? {
            model,
            commands: [
              SyncCloudflareRun({
                run,
                workspace: model.workspace,
                operation: 'Poll',
              }),
            ],
          }
        : { model }
    },
    ClickedReconnectRun: ({ id }) => {
      const run = model.workspace.runs.find(item => item.id === id)
      if (!run || run.execution._tag !== 'Cloudflare') {
        return { model }
      }
      const reconnected = modifyFields(run, { token: token => token + 1 })
      return {
        model: modifyFields(model, {
          workspace: workspace => replaceRun(workspace, reconnected),
        }),
        commands: [
          SyncCloudflareRun({
            run: reconnected,
            workspace: model.workspace,
            operation: 'Poll',
          }),
        ],
      }
    },
    ClickedRetryCloudflareDispatch: ({ id }) => {
      const run = model.workspace.runs.find(item => item.id === id)
      if (
        !run ||
        run.execution._tag !== 'Cloudflare' ||
        run.status !== 'Paused'
      ) {
        return { model }
      }
      const retried = modifyFields(run, { token: token => token + 1 })
      const result = persist(model, replaceRun(model.workspace, retried))
      return {
        model: result.model,
        commands: [
          ...(result.commands ?? []),
          SyncCloudflareRun({
            run: retried,
            workspace: result.model.workspace,
            operation: 'Start',
          }),
        ],
      }
    },
    UpdatedRunTarget: ({ id }) => ({
      model: modifyFields(model, {
        modal: modal =>
          modal._tag === 'RunLauncher'
            ? modifyFields(modal, { targetId: () => id })
            : modal,
      }),
    }),
    SubmittedRun: () => {
      if (model.modal._tag !== 'RunLauncher' || model.storage === 'Loading') {
        return { model }
      }
      const editor = model.modal
      if (
        !editor.title.trim() ||
        !workingRequirements(model).some(item => item.id === editor.targetId)
      ) {
        return notify(model, 'Choose a valid artifact and run title.')
      }
      return launchRun(model, {
        title: editor.title.trim(),
        targetId: editor.targetId,
        requirements: launchScopeRequirements(
          workingRequirements(model),
          editor.targetId,
          editor.scope,
        ),
        agents: model.workspace.agents.filter(agent => agent.enabled),
        keepLauncher: editor.launchAnother,
      })
    },
    ClickedRerun: ({ id, scope }) => {
      const run = model.workspace.runs.find(item => item.id === id)
      if (!run || model.storage === 'Loading') {
        return { model }
      }
      if (['Running', 'Paused', 'Cancelling'].includes(run.status)) {
        return notify(model, 'Finish or cancel this run before re-running it.')
      }
      const failedIds = new Set(
        run.tasks
          .filter(task => task.status === 'Failed')
          .map(task => task.agentId),
      )
      const agents =
        scope === 'All'
          ? run.agents
          : run.agents.filter(agent => failedIds.has(agent.id))
      if (Array.isReadonlyArrayEmpty(agents)) {
        return notify(model, 'This run has no failed agents to re-run.')
      }
      return launchRun(model, {
        title: scope === 'All' ? run.title : `${run.title} · failed agents`,
        targetId: run.targetId,
        requirements: run.requirements,
        agents,
        keepLauncher: false,
      })
    },
    CompletedSimulationWave: ({ id, token }) => {
      const run = model.workspace.runs.find(item => item.id === id)
      if (
        !run ||
        run.status !== 'Running' ||
        run.token !== token ||
        run.execution._tag !== 'Simulation'
      ) {
        return { model }
      }
      const context = modifyFields(model.workspace, {
        requirements: () => run.requirements,
        agents: () => run.agents,
      })
      const finished = run.tasks.map(task =>
        task.status === 'Running'
          ? modifyFields(task, {
              status: () => 'Completed',
              output: () => agentOutput(context, run, task.agentId),
            })
          : task,
      )
      const remaining = run.agents.filter(agent =>
        finished.some(
          task => task.agentId === agent.id && task.status === 'Queued',
        ),
      )
      const nextWave = Array.isArrayEmpty(remaining)
        ? run.wave
        : Math.min(...remaining.map(agent => agent.wave))
      const nextRun = modifyFields(run, {
        tasks: () =>
          finished.map(task =>
            task.status === 'Queued' &&
            run.agents.some(
              agent => agent.id === task.agentId && agent.wave === nextWave,
            )
              ? modifyFields(task, { status: () => 'Running' })
              : task,
          ),
        wave: () => nextWave,
        token: current => current + 1,
        status: () =>
          Array.isArrayEmpty(remaining)
            ? 'Completed'
            : run.pauseAfter.includes(run.wave)
              ? 'Paused'
              : 'Running',
      })
      const workspace = record(
        modifyFields(replaceRun(model.workspace, nextRun), {
          approvals: approvals =>
            nextRun.status === 'Completed'
              ? approvals.concat({
                  id: `APR-${id}`,
                  title: `Review ${run.title.toLowerCase()}`,
                  detail: `${run.tasks.length} simulated agents completed their checks on ${run.targetId}. Review the outputs before accepting this revision. No external artifacts have been changed.`,
                  targetId: run.targetId,
                  agentId: 'review',
                  status: 'Pending',
                  runId: run.id,
                })
              : approvals,
        }),
        `${run.id} · stage ${run.wave + 1} completed${nextRun.status === 'Completed' ? ' · awaiting human review' : nextRun.status === 'Paused' ? ' · paused at breakpoint' : ''}`,
      )
      const result = persist(
        model,
        workspace,
        nextRun.status === 'Completed'
          ? 'Fleet run complete. Review the findings below.'
          : nextRun.status === 'Paused'
            ? `Paused after stage ${run.wave + 1}. Resume when you have checked the output.`
            : undefined,
      )
      return {
        model: result.model,
        commands: [
          ...(result.commands ?? []),
          ...(nextRun.status === 'Running'
            ? [WaitForSimulationWave({ id, token: nextRun.token })]
            : []),
        ],
      }
    },
    ClickedPauseRun: ({ id }) => {
      const run = model.workspace.runs.find(item => item.id === id)
      if (run?.status === 'Running' && run.execution._tag === 'Cloudflare') {
        return controlCloudflare(model, run, 'Hold')
      }
      if (run?.execution._tag === 'Preparing') {
        return notify(
          model,
          'Wait for dispatch preparation, or cancel this run.',
        )
      }
      return run?.status === 'Running'
        ? persist(
            model,
            record(
              replaceRun(
                model.workspace,
                modifyFields(run, {
                  status: () => 'Paused',
                  token: token => token + 1,
                }),
              ),
              `${id} paused by engineer`,
            ),
          )
        : { model }
    },
    ClickedResumeRun: ({ id }) => {
      const run = model.workspace.runs.find(item => item.id === id)
      if (!run || run.status !== 'Paused') {
        return { model }
      }
      if (run.execution._tag === 'Cloudflare') {
        return controlCloudflare(model, run, 'Resume')
      }
      if (run.execution._tag === 'Preparing') {
        return { model }
      }
      const resumed = modifyFields(run, {
        status: () => 'Running',
        token: token => token + 1,
      })
      const result = persist(
        model,
        record(
          replaceRun(model.workspace, resumed),
          `${id} resumed by engineer`,
        ),
      )
      return {
        model: result.model,
        commands: [
          ...(result.commands ?? []),
          WaitForSimulationWave({ id, token: resumed.token }),
        ],
      }
    },
    ClickedCancelRun: ({ id }) => {
      const run = model.workspace.runs.find(item => item.id === id)
      if (
        run?.execution._tag === 'Cloudflare' &&
        ['Running', 'Paused', 'Cancelling'].includes(run.status)
      ) {
        return controlCloudflare(model, run, 'Cancel')
      }
      return run && ['Running', 'Paused'].includes(run.status)
        ? persist(
            model,
            record(
              replaceRun(
                model.workspace,
                modifyFields(run, {
                  status: () => 'Cancelled',
                  token: token => token + 1,
                }),
              ),
              `${id} cancelled by engineer`,
            ),
          )
        : { model }
    },
    SelectedRunView: ({ view }) => ({
      model: modifyFields(model, { runView: () => view }),
    }),
    UpdatedRunLogQuery: ({ value }) => ({
      model: modifyFields(model, { runLogQuery: () => value }),
    }),
    SelectedLaunchScope: ({ scope }) => ({
      model: modifyFields(model, {
        modal: modal =>
          modal._tag === 'RunLauncher'
            ? modifyFields(modal, { scope: () => scope })
            : modal,
      }),
    }),
    ToggledApprovalViewed: ({ id }) => ({
      model: modifyFields(model, {
        viewedApprovalIds: ids =>
          ids.includes(id) ? ids.filter(item => item !== id) : [...ids, id],
      }),
    }),
    StagedApprovalDecision: ({ id, decision }) => {
      const approval = model.workspace.approvals.find(item => item.id === id)
      if (!approval || approval.status !== 'Pending') {
        return { model }
      }
      const existing = model.stagedDecisions.find(item => item.id === id)
      return {
        model: modifyFields(model, {
          stagedDecisions: staged =>
            existing?.decision === decision
              ? staged.filter(item => item.id !== id)
              : [
                  ...staged.filter(item => item.id !== id),
                  { id, decision, reason: existing?.reason ?? '' },
                ],
          viewedApprovalIds: ids => (ids.includes(id) ? ids : [...ids, id]),
        }),
      }
    },
    UpdatedDismissReason: ({ id, value }) => ({
      model: modifyFields(model, {
        stagedDecisions: staged =>
          staged.map(item =>
            item.id === id ? modifyFields(item, { reason: () => value }) : item,
          ),
      }),
    }),
    ClearedReview: () => ({
      model: modifyFields(model, { stagedDecisions: () => [] }),
    }),
    SubmittedReview: () => {
      const staged = model.stagedDecisions.filter(item =>
        model.workspace.approvals.some(
          approval => approval.id === item.id && approval.status === 'Pending',
        ),
      )
      if (Array.isArrayEmpty(staged)) {
        return notify(model, 'Stage at least one decision before submitting.')
      }
      if (
        staged.some(item => item.decision === 'Rejected' && !item.reason.trim())
      ) {
        return notify(model, 'Add a reason for every dismissed finding.')
      }
      const workspace = staged.reduce(
        (current, item) =>
          applyDecision(current, item.id, item.decision, item.reason.trim()),
        model.workspace,
      )
      return persist(
        modifyFields(model, { stagedDecisions: () => [] }),
        workspace,
        `Review submitted · ${staged.length} decision${staged.length === 1 ? '' : 's'} recorded. Artifacts are unchanged.`,
      )
    },
    ClickedApprove: ({ id }) => decide(model, id, 'Approved'),
    ClickedReject: ({ id }) => decide(model, id, 'Rejected'),
    ClickedSettings: () => ({
      model: modifyFields(model, {
        isUserMenuOpen: () => false,
        modal: () => Modal.Settings(),
      }),
    }),
    ToggledUserMenu: () => ({
      model: modifyFields(model, { isUserMenuOpen: value => !value }),
    }),
    ClosedUserMenu: () => ({
      model: modifyFields(model, { isUserMenuOpen: () => false }),
    }),
    ClosedModal: () => ({
      model: modifyFields(model, { modal: () => Modal.Closed() }),
    }),
    ClickedFinding: ({ runId, agentId }) => ({
      model: modifyFields(model, {
        maybeOpenFinding: () => Option.some({ runId, agentId }),
        isFindingSourceShown: () => false,
      }),
      commands: [FocusFinding()],
    }),
    ClosedFinding: () => ({
      model: modifyFields(model, { maybeOpenFinding: () => Option.none() }),
    }),
    ClickedOutsidePanel: () => ({
      model: Option.isSome(model.maybeOpenFinding)
        ? modifyFields(model, { maybeOpenFinding: () => Option.none() })
        : modifyFields(model, { maybeSelectedNode: () => Option.none() }),
    }),
    SteppedFinding: ({ direction }) =>
      Option.match(model.maybeOpenFinding, {
        onNone: () => ({ model }),
        onSome: open => {
          const run = model.workspace.runs.find(
            candidate => candidate.id === open.runId,
          )
          const ids = run ? findingTasks(run).map(task => task.agentId) : []
          const index = ids.indexOf(open.agentId)
          const step = direction === 'Next' ? 1 : -1
          const nextId = ids[(index + step + ids.length) % ids.length]
          return nextId === undefined
            ? { model }
            : {
                model: modifyFields(model, {
                  maybeOpenFinding: () =>
                    Option.some({ runId: open.runId, agentId: nextId }),
                }),
              }
        },
      }),
    ToggledFindingSource: () => ({
      model: modifyFields(model, { isFindingSourceShown: shown => !shown }),
    }),
    ClickedCopyFinding: () =>
      Option.match(model.maybeOpenFinding, {
        onNone: () => ({ model }),
        onSome: ({ runId, agentId }) => ({
          model,
          commands: [
            CopyFinding({
              text: findingText(model.workspace, runId, agentId),
            }),
          ],
        }),
      }),
    CompletedCopyFinding: () => notify(model, 'Finding copied as Markdown.'),
    FailedCopyFinding: () =>
      notify(model, 'This browser blocked copying the finding.'),
    CompletedFocusFinding: () => ({ model }),
    SelectedRunFilter: ({ filter }) => ({
      model: modifyFields(model, { runFilter: () => filter }),
    }),
    DismissedToast: () => ({
      model: modifyFields(model, { maybeToast: () => Option.none() }),
    }),
    CompletedLoadWorkspace: ({ workspace, restored }) => ({
      model: modifyFields(model, {
        workspace: () => workspace,
        storage: () => 'Ready',
        maybeToast: () =>
          restored && workspace.runs.some(run => run.status === 'Paused')
            ? Option.some(
                'Simulation runs paused. Live runs may continue remotely; reconnect to retrieve their status.',
              )
            : Option.none(),
      }),
    }),
    FailedLoadWorkspace: ({ error }) => ({
      model: modifyFields(model, {
        storage: () => 'Unavailable',
        maybeToast: () => Option.some(error),
        isToastError: () => true,
      }),
    }),
    CompletedSaveWorkspace: () => ({ model }),
    FailedSaveWorkspace: ({ error }) => ({
      model: modifyFields(model, {
        storage: () => 'Unavailable',
        maybeToast: () => Option.some(error),
        isToastError: () => true,
      }),
    }),
    ClickedExport: () => ({
      model,
      commands: [ExportWorkspace({ workspace: model.workspace })],
    }),
    CompletedExport: () => notify(model, 'Workspace exported as JSON.'),
    FailedExport: ({ error }) => notify(model, error),
    ClickedGraphZoom: ({ direction }) => ({
      model: modifyFields(model, {
        graphZoom: zoom =>
          direction === 'Reset'
            ? 1
            : Math.min(
                1.6,
                Math.max(
                  0.5,
                  Math.round((zoom + (direction === 'In' ? 0.1 : -0.1)) * 10) /
                    10,
                ),
              ),
      }),
    }),
    ClickedSortColumn: ({ key }) => {
      const isActive = Option.exists(
        model.maybeSortKey,
        active => active === key,
      )
      return {
        model: modifyFields(model, {
          maybeSortKey: () =>
            isActive && model.sortDirection === 'Descending'
              ? Option.none()
              : Option.some(key),
          sortDirection: () =>
            isActive && model.sortDirection === 'Ascending'
              ? 'Descending'
              : 'Ascending',
        }),
      }
    },
    ToggledArtifactSelection: ({ id }) => ({
      model: modifyFields(model, {
        selectedArtifactIds: ids =>
          ids.includes(id)
            ? ids.filter(candidate => candidate !== id)
            : ids.concat(id),
      }),
    }),
    ToggledAllArtifacts: () => {
      const ids = visibleArtifacts(model, workingRequirements(model)).map(
        item => item.id,
      )
      const isAllSelected =
        ids.length > 0 &&
        ids.every(id => model.selectedArtifactIds.includes(id))
      return {
        model: modifyFields(model, {
          selectedArtifactIds: () => (isAllSelected ? [] : ids),
        }),
      }
    },
    ClickedClearSelection: () => ({
      model: modifyFields(model, { selectedArtifactIds: () => [] }),
    }),
    SelectedBulkStatus: ({ status }) => {
      const requirements = workingRequirements(model)
      const ids = model.selectedArtifactIds.filter(id =>
        requirements.some(item => item.id === id && item.status !== status),
      )
      if (Array.isArrayEmpty(ids)) {
        return {
          model: modifyFields(model, { selectedArtifactIds: () => [] }),
        }
      }
      const updated = requirements.map(item =>
        ids.includes(item.id)
          ? modifyFields(item, {
              status: () => status,
              revision: revision => revision + 1,
            })
          : item,
      )
      const summary = `${ids.length} ${ids.length === 1 ? 'artifact' : 'artifacts'} marked ${status.toLowerCase()}`
      return persist(
        modifyFields(model, { selectedArtifactIds: () => [] }),
        record(
          writeRequirements(model, updated),
          `${summary} · Dakota Edwards`,
        ),
        `${summary}.`,
      )
    },
    SelectedAgent: ({ id }) => ({
      model: modifyFields(model, { maybeSelectedAgent: () => Option.some(id) }),
    }),
    SelectedGroupBy: ({ groupBy }) => ({
      model: modifyFields(model, {
        groupBy: () => groupBy,
        collapsedGroups: () => [],
      }),
    }),
    ToggledGroup: ({ key }) => ({
      model: modifyFields(model, {
        collapsedGroups: groups =>
          groups.includes(key)
            ? groups.filter(item => item !== key)
            : [...groups, key],
      }),
    }),
    SelectedBulkOwner: ({ owner }) => {
      const requirements = workingRequirements(model)
      const ids = new Set(
        model.selectedArtifactIds.filter(id =>
          requirements.some(item => item.id === id && item.owner !== owner),
        ),
      )
      if (!owner.trim() || ids.size === 0) {
        return { model }
      }
      const updated = requirements.map(item =>
        ids.has(item.id)
          ? modifyFields(item, {
              owner: () => owner,
              revision: revision => revision + 1,
            })
          : item,
      )
      const summary = `${ids.size} ${ids.size === 1 ? 'artifact' : 'artifacts'} assigned to ${owner}`
      return persist(
        modifyFields(model, { selectedArtifactIds: () => [] }),
        record(
          writeRequirements(model, updated),
          `${summary} · Dakota Edwards`,
        ),
        `${summary}.`,
      )
    },
    ToggledPauseAfter: ({ wave }) => ({
      model: modifyFields(model, {
        pauseAfter: waves =>
          waves.includes(wave)
            ? waves.filter(item => item !== wave)
            : Array.sort([...waves, wave], Order.Number),
      }),
    }),
    ToggledLaunchAnother: () => ({
      model: modifyFields(model, {
        modal: modal =>
          modal._tag === 'RunLauncher'
            ? modifyFields(modal, { launchAnother: value => !value })
            : modal,
      }),
    }),
    ClickedShortcuts: () => ({
      model: modifyFields(model, { modal: () => Modal.Shortcuts() }),
    }),
    SelectedGraphPreviewTab: ({ tab }) => ({
      model: modifyFields(model, { graphPreviewTab: () => tab }),
    }),
    SelectedGraphView: ({ view }) => ({
      model: modifyFields(model, { graphView: () => view }),
    }),
    SelectedGraphScope: ({ scope }) =>
      Option.match(model.maybeSelectedNode, {
        onNone: () => ({
          model: modifyFields(model, { graphScope: () => scope }),
        }),
        onSome: id => ({
          model: modifyFields(model, { graphScope: () => scope }),
          commands: [RevealGraphNode({ id })],
        }),
      }),
    UpdatedGraphQuery: ({ value }) => ({
      model: modifyFields(model, { graphQuery: () => value }),
    }),
    SelectedGraphSearchResult: ({ id }) => ({
      model: modifyFields(model, {
        graphQuery: () => '',
        graphView: () => 'Graph',
        maybeSelectedNode: () => Option.some(id),
      }),
      commands: [RevealGraphNode({ id })],
    }),
    ToggledGraphKind: ({ kind }) => ({
      model: modifyFields(model, {
        hiddenGraphKinds: kinds =>
          kinds.includes(kind)
            ? kinds.filter(other => other !== kind)
            : kinds.concat(kind),
      }),
    }),
    ToggledMatrixGaps: () => ({
      model: modifyFields(model, { isMatrixGapsOnly: isOn => !isOn }),
    }),
    SelectedMatrixArtifact: ({ id }) => ({
      model: modifyFields(model, {
        graphView: () => 'Graph',
        maybeSelectedNode: () => Option.some(id),
      }),
      commands: [RevealGraphNode({ id })],
    }),
    ToggledWorkspaceMenu: () => ({
      model: modifyFields(model, { isWorkspaceMenuOpen: value => !value }),
    }),
    ClosedWorkspaceMenu: () => ({
      model: modifyFields(model, { isWorkspaceMenuOpen: () => false }),
    }),
    DismissedSetup: () => ({
      model: modifyFields(model, { isSetupDismissed: () => true }),
    }),
    PressedTreeHandle: () => ({
      model: modifyFields(model, {
        maybeTreeDrag: () =>
          Option.some({
            startHeight: model.sidebarTreeHeight,
            maybeStartY: Option.none(),
          }),
      }),
    }),
    MovedTreeHandle: ({ y }) =>
      Option.match(model.maybeTreeDrag, {
        onNone: () => ({ model }),
        onSome: drag =>
          Option.match(drag.maybeStartY, {
            onNone: () => ({
              model: modifyFields(model, {
                maybeTreeDrag: () =>
                  Option.some({
                    startHeight: drag.startHeight,
                    maybeStartY: Option.some(y),
                  }),
              }),
            }),
            onSome: startY => ({
              model: modifyFields(model, {
                sidebarTreeHeight: () =>
                  clampTreeHeight(drag.startHeight + startY - y),
              }),
            }),
          }),
      }),
    ReleasedTreeHandle: () => ({
      model: modifyFields(model, { maybeTreeDrag: () => Option.none() }),
    }),
    PressedTreeHandleKey: ({ key }) => {
      const height =
        key === 'ArrowUp'
          ? model.sidebarTreeHeight + 16
          : key === 'ArrowDown'
            ? model.sidebarTreeHeight - 16
            : key === 'Home'
              ? treeMinHeight
              : key === 'End'
                ? treeMaxHeight
                : undefined
      return height === undefined
        ? { model }
        : {
            model: modifyFields(model, {
              sidebarTreeHeight: () => clampTreeHeight(height),
            }),
          }
    },
    ResetTreeHeight: () => ({
      model: modifyFields(model, {
        sidebarTreeHeight: () => treeDefaultHeight,
      }),
    }),
    PressedSidebarHandle: () =>
      model.isSidebarCollapsed
        ? { model }
        : { model: modifyFields(model, { isResizingSidebar: () => true }) },
    MovedSidebarHandle: ({ x }) =>
      model.isResizingSidebar
        ? {
            model: modifyFields(model, {
              sidebarWidth: () => clampSidebarWidth(x),
            }),
          }
        : { model },
    ReleasedSidebarHandle: () =>
      model.isResizingSidebar
        ? {
            model: modifyFields(model, { isResizingSidebar: () => false }),
            commands: [SaveSidebarWidth({ width: model.sidebarWidth })],
          }
        : { model },
    PressedSidebarHandleKey: ({ key }) => {
      const width =
        key === 'ArrowLeft'
          ? model.sidebarWidth - 16
          : key === 'ArrowRight'
            ? model.sidebarWidth + 16
            : key === 'Home'
              ? sidebarMinWidth
              : key === 'End'
                ? sidebarMaxWidth
                : undefined
      if (width === undefined || model.isSidebarCollapsed) {
        return { model }
      }
      const next = clampSidebarWidth(width)
      return {
        model: modifyFields(model, { sidebarWidth: () => next }),
        commands: [SaveSidebarWidth({ width: next })],
      }
    },
    ResetSidebarWidth: () => ({
      model: modifyFields(model, { sidebarWidth: () => sidebarDefaultWidth }),
      commands: [SaveSidebarWidth({ width: sidebarDefaultWidth })],
    }),
    ClickedLoadTwinScenario: () => {
      const requirements = workingRequirements(model)
      if (hasTwinScenario(requirements) || model.storage === 'Loading') {
        return { model }
      }
      return persist(
        model,
        record(
          writeRequirements(model, requirements.concat(seedTwinArtifacts())),
          'F-35 modular power assembly scenario added · Dakota Edwards',
        ),
      )
    },
    SelectedTwinFocus: ({ focus }) => ({
      model: modifyFields(model, { twinFocus: () => focus }),
    }),
    SelectedTwinPanelTab: ({ tab }) => ({
      model: modifyFields(model, { twinPanelTab: () => tab }),
    }),
    ClickedTwinPart: ({ part }) => ({
      model: modifyFields(model, {
        twinFocus: () => (part === 'Cockpit' ? 'Cockpit' : 'Aft bay'),
      }),
    }),
    ClickedSwapTwinAvionics: () => {
      const requirements = workingRequirements(model)
      if (
        !hasTwinScenario(requirements) ||
        model.storage === 'Loading' ||
        isAvionicsUpgraded(requirements)
      ) {
        return { model }
      }
      const swapped = persist(
        modifyFields(model, {
          twinFocus: () => 'Cockpit',
          twinProposal: () => 'Drafting',
          twinCheck: () => 'Not run',
        }),
        record(
          writeRequirements(model, swapTwinAvionics(requirements)),
          `Cockpit avionics module swapped in · ${avionicsRequirementIds.length} requirements revised · Dakota Edwards`,
        ),
        `New avionics swapped in. ${avionicsRequirementIds.length} requirements revised; the power agent is drafting a redesign.`,
      )
      return {
        model: swapped.model,
        commands: [...(swapped.commands ?? []), WaitTwinProposal()],
      }
    },
    OpenedTwinPartPicker: ({ slot }) => ({
      model: modifyFields(model, {
        modal: () =>
          Modal.PartPicker({
            slot,
            selectedId: suggestedPart(workingRequirements(model), slot).id,
          }),
      }),
    }),
    SelectedTwinCatalogItem: ({ id }) => ({
      model: modifyFields(model, {
        modal: modal =>
          modal._tag === 'PartPicker'
            ? modifyFields(modal, { selectedId: () => id })
            : modal,
      }),
    }),
    ClickedInstallTwinPart: () => {
      const picker = model.modal
      const requirements = workingRequirements(model)
      const item =
        picker._tag === 'PartPicker'
          ? twinCatalog.find(candidate => candidate.id === picker.selectedId)
          : undefined
      if (
        !item ||
        model.storage === 'Loading' ||
        catalogBlocker(requirements, item) !== undefined
      ) {
        return { model }
      }
      const closed = modifyFields(model, { modal: () => Modal.Closed() })
      if (item.slot === 'Cockpit') {
        return isAvionicsUpgraded(requirements)
          ? persist(
              modifyFields(closed, {
                twinFocus: () => 'Cockpit',
                twinProposal: () => 'None',
                twinCheck: () => 'Not run',
              }),
              record(
                writeRequirements(
                  model,
                  installTwinRevision(requirements, 'A'),
                ),
                `${item.id} Rev ${item.revision} reinstalled from Teamcenter · Dakota Edwards`,
              ),
              `${item.id} reinstalled. Requirements restored.`,
            )
          : updateMessage(closed, Message.ClickedSwapTwinAvionics())
      }
      if (twinRevision(requirements) === 'A') {
        return updateMessage(
          closed,
          Message.ClickedInstallTwinRevision({ revision: 'B' }),
        )
      }
      const restored = installTwinRevision(requirements, 'A')
      return persist(
        modifyFields(closed, {
          twinFocus: () => 'Aft bay',
          twinProposal: () =>
            isAvionicsUpgraded(requirements) ? 'Pending' : 'None',
          twinCheck: () => 'Not run',
          twinReviewed: () => [],
          maybeTwinPackage: () => Option.none(),
          twinReports: () => [],
        }),
        record(
          writeRequirements(
            model,
            isAvionicsUpgraded(requirements)
              ? swapTwinAvionics(restored)
              : restored,
          ),
          `${item.id} Rev ${item.revision} reinstalled from Teamcenter · Dakota Edwards`,
        ),
        `Power assembly ${item.id} reinstalled.`,
      )
    },
    ClickedInstallTwinRevision: ({ revision }) => {
      const requirements = workingRequirements(model)
      if (
        !hasTwinScenario(requirements) ||
        model.storage === 'Loading' ||
        twinRevision(requirements) === revision ||
        (revision === 'B' && model.twinProposal !== 'Approved')
      ) {
        return { model }
      }
      const updated = installTwinRevision(requirements, revision)
      const count = updated.filter(
        (item, index) => item !== requirements[index],
      ).length
      const summary =
        revision === 'B'
          ? `Power assembly Rev B placed in the systems model · ${count} artifacts revised`
          : `Power assembly reverted to Rev A · ${count} artifacts restored`
      return persist(
        modifyFields(model, {
          twinFocus: () => 'Aft bay',
          twinProposal: () =>
            revision === 'B'
              ? 'Approved'
              : isAvionicsUpgraded(updated)
                ? 'Pending'
                : 'None',
          twinCheck: () => 'Not run',
          twinReviewed: () => [],
          maybeTwinPackage: () => Option.none(),
          twinReports: () => [],
        }),
        record(
          writeRequirements(model, updated),
          `${summary} · Dakota Edwards`,
        ),
        `${summary}.`,
      )
    },
    ClickedDraftTwinProposal: () => {
      const requirements = workingRequirements(model)
      return !isAvionicsUpgraded(requirements) ||
        twinRevision(requirements) === 'B' ||
        model.twinProposal === 'Drafting'
        ? { model }
        : {
            model: modifyFields(model, { twinProposal: () => 'Drafting' }),
            commands: [WaitTwinProposal()],
          }
    },
    DraftedTwinProposal: () => {
      const requirements = workingRequirements(model)
      if (
        model.twinProposal !== 'Drafting' ||
        !isAvionicsUpgraded(requirements) ||
        twinRevision(requirements) === 'B'
      ) {
        return { model }
      }
      return persist(
        modifyFields(model, { twinProposal: () => 'Pending' }),
        record(
          model.workspace,
          `Power agent proposed MPA Rev B (${proposalPartChanges.length} part changes, ${derivedArtifacts.length} derived requirements) · awaiting ${proposalReviewer.role.toLowerCase()} approval`,
        ),
      )
    },
    OpenedBoardReview: () =>
      model.twinProposal !== 'Pending'
        ? { model }
        : {
            model: modifyFields(model, {
              modal: () => Modal.BoardReview({ tab: 'PDR' }),
            }),
          },
    SelectedBoardReviewTab: ({ tab }) =>
      model.modal._tag !== 'BoardReview'
        ? { model }
        : {
            model: modifyFields(model, {
              modal: () => Modal.BoardReview({ tab }),
            }),
          },
    SelectedTwinPdrFile: ({ files }) => {
      const [file] = files
      return file ? { model, commands: [ReadTwinPdr({ file })] } : { model }
    },
    LoadedTwinPdr: ({ upload }) =>
      model.twinProposal !== 'Pending'
        ? { model }
        : persist(
            modifyFields(model, { maybeTwinPdr: () => Option.some(upload) }),
            record(
              model.workspace,
              `PDR uploaded for MPA Rev B · ${upload.name}`,
            ),
            `Attached ${upload.name} to the Rev B review.`,
          ),
    FailedLoadTwinPdr: ({ name }) =>
      notifyError(model, `Couldn't read ${name}.`),
    ClickedRemoveTwinPdr: () => ({
      model: modifyFields(model, { maybeTwinPdr: () => Option.none() }),
    }),
    UpdatedTwinDesign: ({ index, field, value }) =>
      model.twinProposal !== 'Pending'
        ? { model }
        : {
            model: modifyFields(model, {
              twinDesign: design =>
                design.map((row, rowIndex) =>
                  rowIndex === index
                    ? {
                        part: field === 'part' ? value : row.part,
                        before: field === 'before' ? value : row.before,
                        after: field === 'after' ? value : row.after,
                        trace: field === 'trace' ? value : row.trace,
                      }
                    : row,
                ),
            }),
          },
    ClickedAddTwinDesignChange: () =>
      model.twinProposal !== 'Pending'
        ? { model }
        : {
            model: modifyFields(model, {
              twinDesign: design => [
                ...design,
                { part: '', before: '', after: '', trace: '' },
              ],
            }),
          },
    ClickedRemoveTwinDesignChange: ({ index }) => ({
      model: modifyFields(model, {
        twinDesign: design =>
          design.filter((_, rowIndex) => rowIndex !== index),
      }),
    }),
    ClickedResetTwinDesign: () => ({
      model: modifyFields(model, { twinDesign: () => agentDesign }),
    }),
    ClickedApproveTwinProposal: () =>
      model.twinProposal !== 'Pending' ||
      model.storage === 'Loading' ||
      model.modal._tag !== 'BoardReview'
        ? { model }
        : updateMessage(
            modifyFields(model, {
              twinProposal: () => 'Approved',
              modal: () => Modal.Closed(),
              workspace: workspace =>
                record(
                  workspace,
                  [
                    `MPA Rev B proposal approved · ${proposalReviewer.name}, ${proposalReviewer.role}`,
                    isEngineerDesign(model.twinDesign)
                      ? 'engineer-edited design'
                      : 'agent design',
                    ...Option.match(model.maybeTwinPdr, {
                      onNone: () => ['agent PDR'],
                      onSome: upload => [`PDR ${upload.name}`],
                    }),
                  ].join(' · '),
                ),
            }),
            Message.ClickedInstallTwinRevision({ revision: 'B' }),
          ),
    ClickedRejectTwinProposal: () =>
      model.twinProposal !== 'Pending'
        ? { model }
        : persist(
            modifyFields(model, {
              twinProposal: () => 'Rejected',
              modal: () => Modal.Closed(),
            }),
            record(
              model.workspace,
              `MPA Rev B proposal rejected · ${proposalReviewer.name}, ${proposalReviewer.role}`,
            ),
            'Rev B rejected. Rev A stays in the twin.',
          ),
    ClickedRunTwinCheck: () =>
      twinRevision(workingRequirements(model)) !== 'B' ||
      model.twinCheck === 'Running'
        ? { model }
        : {
            model: modifyFields(model, { twinCheck: () => 'Running' }),
            commands: [WaitTwinCheck()],
          },
    CompletedTwinCheck: () => {
      const requirements = workingRequirements(model)
      if (model.twinCheck !== 'Running' || twinRevision(requirements) !== 'B') {
        return { model }
      }
      const checks = requirementChecks('B')
      const passed = checks.filter(check => check.isPass).length
      const pending = twinChanges(requirements).filter(
        change => change.status !== 'Verified',
      ).length
      return persist(
        modifyFields(model, { twinCheck: () => 'Done' }),
        record(
          model.workspace,
          `Rev B requirement check · ${passed}/${checks.length} pass · ${pending} artifacts to re-verify`,
        ),
        `${passed} of ${checks.length} checks pass on Rev B. ${pending} artifacts need re-verification.`,
      )
    },
    ClickedResetTwin: () => {
      const requirements = workingRequirements(model)
      if (!hasTwinScenario(requirements) || model.storage === 'Loading') {
        return { model }
      }
      return persist(
        modifyFields(model, {
          twinFocus: () => 'Airframe',
          twinPanelTab: () => 'Change',
          twinProposal: () => 'None',
          twinCheck: () => 'Not run',
          twinReviewed: () => [],
          maybeTwinPackage: () => Option.none(),
          twinReports: () => [],
          twinDesign: () => agentDesign,
          maybeTwinPdr: () => Option.none(),
          modal: () => Modal.Closed(),
        }),
        record(
          writeRequirements(model, installTwinRevision(requirements, 'A')),
          'Digital twin reset to the baseline configuration · Dakota Edwards',
        ),
        'Digital twin reset to the baseline.',
      )
    },
    ClickedOpenTwinMatrix: () =>
      updateMessage(
        modifyFields(model, { graphView: () => 'Matrix' }),
        Message.ClickedTraceTwinArtifact({ id: 'REQ-AVN-01' }),
      ),
    ToggledTwinReview: ({ item }) => {
      if (
        twinRevision(workingRequirements(model)) !== 'B' ||
        model.twinReports.length === 0
      ) {
        return { model }
      }
      const isSigned = !model.twinReviewed.includes(item)
      const summary = `${signoffTitle(item)} ${isSigned ? 'signed off' : 'sign-off revoked'}`
      const token = model.twinReportSaveToken + 1
      const result = persist(
        modifyFields(model, {
          twinReviewed: reviewed =>
            isSigned
              ? reviewed.concat([item])
              : reviewed.filter(value => value !== item),
          twinReports: reports =>
            reports.map(report =>
              report.name.startsWith('HRD-')
                ? modifyFields(report, {
                    content: content =>
                      stampHrdSignoff(content, item, isSigned),
                  })
                : report,
            ),
          twinReportSync: () => 'Saving',
          twinReportSaveToken: () => token,
        }),
        record(model.workspace, `${summary} · Dakota Edwards`),
        `${summary}.`,
      )
      return {
        ...result,
        commands: [...(result.commands ?? []), WaitTwinReportSave({ token })],
      }
    },
    ClickedGenerateTwinPackage: () => {
      const requirements = workingRequirements(model)
      if (twinRevision(requirements) !== 'B') {
        return notify(
          model,
          'Place the new hardware in the systems model first.',
        )
      }
      if (model.twinCheck !== 'Done') {
        return notify(
          model,
          'Run the requirement check on Rev B before drafting DO-254 reports.',
        )
      }
      if (model.isGeneratingTwinPackage) {
        return { model }
      }
      return {
        model: modifyFields(model, { isGeneratingTwinPackage: () => true }),
        commands: [DraftTwinReports({ requirements })],
      }
    },
    DraftedTwinReports: ({ files }) => {
      const token = model.twinReportSaveToken + 1
      return {
        model: modifyFields(model, {
          isGeneratingTwinPackage: () => false,
          twinPanelTab: () => 'DO-254',
          twinReports: () => files,
          twinReportTab: () =>
            files.find(file => file.name.endsWith('.md'))?.name ?? '',
          twinReportSync: () => 'Saving',
          twinReportSaveToken: () => token,
        }),
        commands: [SaveTwinReports({ files, token })],
      }
    },
    LoadedTwinReports: ({ files }) =>
      files.length === 0 ||
      model.twinReports.length > 0 ||
      twinRevision(workingRequirements(model)) !== 'B'
        ? { model }
        : {
            model: modifyFields(model, {
              twinReports: () => files,
              twinReportTab: () =>
                files.find(file => file.name.endsWith('.md'))?.name ?? '',
              twinReportSync: () => 'Saved',
            }),
          },
    ElapsedTwinReportSave: ({ token }) =>
      token === model.twinReportSaveToken
        ? {
            model,
            commands: [SaveTwinReports({ files: model.twinReports, token })],
          }
        : { model },
    SavedTwinReports: ({ token }) => ({
      model:
        token === model.twinReportSaveToken
          ? modifyFields(model, { twinReportSync: () => 'Saved' })
          : model,
    }),
    FailedSaveTwinReports: ({ token }) => ({
      model:
        token === model.twinReportSaveToken
          ? modifyFields(model, { twinReportSync: () => 'Failed' })
          : model,
    }),
    SelectedTwinReport: ({ name }) => ({
      model: modifyFields(model, { twinReportTab: () => name }),
    }),
    EditedTwinReport: ({ name, markdown }) => {
      if (
        !model.twinReports.some(
          report => report.name === name && report.content !== markdown,
        )
      ) {
        return { model }
      }
      const token = model.twinReportSaveToken + 1
      return {
        commands: [WaitTwinReportSave({ token })],
        model: modifyFields(model, {
          twinReportSync: () => 'Saving',
          twinReportSaveToken: () => token,
          twinReports: reports =>
            reports.map(report =>
              report.name === name && report.content !== markdown
                ? modifyFields(report, {
                    content: () => markdown,
                    isEdited: () => true,
                  })
                : report,
            ),
        }),
      }
    },
    ClickedDownloadTwinPackage: () =>
      model.twinReports.length === 0 ||
      model.isGeneratingTwinPackage ||
      model.twinReviewed.length < TwinReviewItem.literals.length
        ? { model }
        : {
            model: modifyFields(model, { isGeneratingTwinPackage: () => true }),
            commands: [
              BuildTwinPackage({
                files: model.twinReports,
                reviewed: model.twinReviewed,
              }),
            ],
          },
    GeneratedTwinPackage: ({ name, digest, bytes, files }) =>
      persist(
        modifyFields(model, {
          isGeneratingTwinPackage: () => false,
          maybeTwinPackage: () =>
            Option.some({ name, digest, bytes, files, isSent: false }),
        }),
        record(
          model.workspace,
          `DO-254 package ${name} generated · Dakota Edwards`,
        ),
        `${name} downloaded.`,
      ),
    FailedTwinPackage: ({ error }) =>
      notify(
        modifyFields(model, { isGeneratingTwinPackage: () => false }),
        error,
      ),
    ClickedMarkTwinPackageSent: () =>
      Option.match(model.maybeTwinPackage, {
        onNone: () => ({ model }),
        onSome: item =>
          item.isSent
            ? { model }
            : persist(
                modifyFields(model, {
                  maybeTwinPackage: () =>
                    Option.some(modifyFields(item, { isSent: () => true })),
                }),
                record(
                  model.workspace,
                  `DO-254 package ${item.name} marked as sent to the customer · Dakota Edwards`,
                ),
                'Package marked as sent to the customer.',
              ),
      }),
    ClickedTraceTwinArtifact: ({ id }) => ({
      model: modifyFields(model, {
        page: () => 'Systems graph',
        search: () => '',
        filter: () => 'All artifacts',
        maybeSelectedNode: () => Option.some(id),
      }),
      commands: [RevealGraphNode({ id })],
    }),
    LoadedSidebarWidth: ({ width }) => ({
      model: modifyFields(model, {
        sidebarWidth: () => clampSidebarWidth(width),
      }),
    }),
    CompletedSaveSidebarWidth: () => ({ model }),
    CompletedRevealGraphNode: () => ({ model }),
    UpdatedCloudflareAccountId: ({ value }) => ({
      model: modifyFields(model, {
        cloudflareAccountId: () => value,
        maybeCloudflareTest: () => Option.none(),
      }),
    }),
    UpdatedCloudflareToken: ({ value }) => ({
      model: modifyFields(model, {
        cloudflareTokenDraft: () => value,
        maybeCloudflareTest: () => Option.none(),
      }),
    }),
    SubmittedCloudflareCredentials: () =>
      validCloudflareAccountId(model.cloudflareAccountId) &&
      validCloudflareToken(model.cloudflareTokenDraft)
        ? {
            model: modifyFields(model, { cloudflareTokenDraft: () => '' }),
            commands: [
              SyncCloudflareCredentials({
                operation: 'Save',
                accountId: model.cloudflareAccountId,
                token: model.cloudflareTokenDraft,
              }),
            ],
          }
        : { model },
    ClickedForgetCloudflareCredentials: () => ({
      model: modifyFields(model, {
        cloudflareTokenDraft: () => '',
        maybeCloudflareTest: () => Option.none(),
      }),
      commands: [
        SyncCloudflareCredentials({
          operation: 'Forget',
          accountId: model.cloudflareAccountId,
          token: '',
        }),
      ],
    }),
    ClickedTestCloudflareCredentials: () => ({
      model: modifyFields(model, {
        maybeCloudflareTest: () =>
          Option.some({ state: 'Testing', detail: '', latencyMs: 0 } as const),
      }),
      commands: [
        TestCloudflareCredentials({
          accountId: model.cloudflareAccountId,
          token: model.cloudflareTokenDraft,
        }),
      ],
    }),
    LoadedCloudflareCredentials: ({ accountId, hasToken, mode }) => ({
      model: modifyFields(model, {
        cloudflareAccountId: () => accountId,
        hasStoredCloudflareToken: () => hasToken,
        cloudflareAiMode: () => mode,
      }),
      commands: [ProbeExecutor()],
    }),
    CompletedCloudflareTest: ({ ok, detail, latencyMs }) => ({
      model: modifyFields(model, {
        maybeCloudflareTest: () =>
          Option.some({
            state: ok ? ('Passed' as const) : ('Failed' as const),
            detail,
            latencyMs,
          }),
      }),
    }),
    ToggledSidebar: () => ({
      model: modifyFields(model, {
        isSidebarCollapsed: collapsed => !collapsed,
      }),
    }),
    PressedCommandPalette: () =>
      model.modal._tag === 'CommandPalette'
        ? { model: modifyFields(model, { modal: () => Modal.Closed() }) }
        : model.modal._tag === 'Closed'
          ? {
              model: modifyFields(model, {
                modal: () => Modal.CommandPalette({ query: '', index: 0 }),
              }),
              commands: [FocusPalette()],
            }
          : { model },
    UpdatedPaletteQuery: ({ value }) => ({
      model: modifyFields(model, {
        modal: modal =>
          modal._tag === 'CommandPalette'
            ? Modal.CommandPalette({ query: value, index: 0 })
            : modal,
      }),
    }),
    MovedPaletteHighlight: ({ delta }) => {
      if (model.modal._tag !== 'CommandPalette') {
        return { model }
      }
      const palette = model.modal
      const count = paletteItems(
        model,
        workingRequirements(model),
        palette.query,
      ).length
      return {
        model: modifyFields(model, {
          modal: () =>
            Modal.CommandPalette({
              query: palette.query,
              index: count === 0 ? 0 : (palette.index + delta + count) % count,
            }),
        }),
      }
    },
    SubmittedPalette: () =>
      model.modal._tag === 'CommandPalette'
        ? choosePaletteItem(model, model.modal.index)
        : { model },
    ChosePaletteItem: ({ index }) => choosePaletteItem(model, index),
    CompletedFocusPalette: () => ({ model }),
    PressedPageShortcut: ({ page }) =>
      update(model, Message.SelectedPage({ page })),
    PressedArtifactShortcut: ({ action }) => {
      if (model.page !== 'Requirements' || model.modal._tag !== 'Closed') {
        return { model }
      }
      const items = visibleArtifacts(model, workingRequirements(model))
      const current = Option.getOrElse(model.maybeSelectedNode, () => '')
      const index = items.findIndex(item => item.id === current)
      if (action === 'Toggle' || action === 'Edit') {
        return index < 0
          ? { model }
          : update(
              model,
              action === 'Toggle'
                ? Message.ToggledArtifactSelection({ id: current })
                : Message.ClickedEditRequirement({ id: current }),
            )
      }
      const next =
        items[
          index < 0
            ? 0
            : Math.min(
                items.length - 1,
                Math.max(0, index + (action === 'Next' ? 1 : -1)),
              )
        ]
      return next
        ? update(model, Message.SelectedNode({ id: next.id }))
        : { model }
    },
  })

type LaunchSpec = Readonly<{
  title: string
  targetId: string
  requirements: ReadonlyArray<Requirement>
  agents: ReadonlyArray<Agent>
  keepLauncher: boolean
}>

const launchRun = (model: Model, spec: LaunchSpec): UpdateReturn => {
  if (
    model.executionMode === 'Cloudflare' &&
    Option.match(model.maybeExecutorStatus, {
      onNone: () => true,
      onSome: status => status.state !== 'Ready',
    })
  ) {
    return notify(
      model,
      'Configure and unlock the Cloudflare Worker before launching live agents. Simulation must be selected explicitly.',
    )
  }
  if (
    model.executionMode === 'Cloudflare' &&
    (spec.agents.length > 8 ||
      spec.requirements.length > 200 ||
      JSON.stringify(spec.requirements).length > 60_000)
  ) {
    return notify(
      model,
      'Live runs support up to 8 agents and 200 artifacts, within 60,000 characters of artifact context.',
    )
  }
  if (Array.isReadonlyArrayEmpty(spec.agents)) {
    return notify(model, 'Enable at least one agent before launching a run.')
  }
  const wave = Math.min(...spec.agents.map(agent => agent.wave))
  const run: Run = {
    id: `RUN-${String(model.workspace.nextId).padStart(3, '0')}`,
    title: spec.title,
    targetId: spec.targetId,
    status: 'Running',
    execution:
      model.executionMode === 'Cloudflare'
        ? Execution.Preparing()
        : Execution.Simulation(),
    wave,
    token: 0,
    created:
      model.executionMode === 'Cloudflare'
        ? 'Workers AI · Pi Durable'
        : 'Local simulation',
    requirements: spec.requirements,
    agents: spec.agents,
    pauseAfter: model.executionMode === 'Simulation' ? model.pauseAfter : [],
    tasks: spec.agents.map(agent => ({
      agentId: agent.id,
      status:
        model.executionMode === 'Simulation' && agent.wave === wave
          ? 'Running'
          : 'Queued',
      output: '',
      session: TaskSession.Pending(),
    })),
  }
  const workspace = record(
    modifyFields(model.workspace, {
      runs: runs => [run, ...runs],
      nextId: next => next + 1,
    }),
    `${run.id} started · ${run.title}`,
  )
  const result = persist(
    spec.keepLauncher
      ? modifyFields(model, { maybeSelectedRun: () => Option.some(run.id) })
      : modifyFields(model, {
          modal: () => Modal.Closed(),
          page: () => 'Runs',
          maybeSelectedRun: () => Option.some(run.id),
        }),
    workspace,
    spec.keepLauncher
      ? `${run.id} started. The launcher stays open for the next run.`
      : undefined,
  )
  return {
    model: result.model,
    commands: [
      ...(result.commands ?? []),
      model.executionMode === 'Cloudflare'
        ? PrepareCloudflareRun({ id: run.id, token: run.token })
        : WaitForSimulationWave({ id: run.id, token: run.token }),
    ],
  }
}

const choosePaletteItem = (model: Model, index: number): UpdateReturn => {
  if (model.modal._tag !== 'CommandPalette') {
    return { model }
  }
  const item = paletteItems(
    model,
    workingRequirements(model),
    model.modal.query,
  )[index]
  return item
    ? update(modifyFields(model, { modal: () => Modal.Closed() }), item.message)
    : { model }
}

// SUBSCRIPTION

const panelSafeZone = [
  '.graph-backdrop',
  '.finding-drawer',
  '.inspector',
  '.toast',
  '[role="dialog"]',
  'button',
  'a',
  'input',
  'select',
  'textarea',
  'label',
  'summary',
  '[role="button"]',
  '[tabindex]',
].join(', ')

export const subscriptions = Subscription.make<Model, Message>()(entry => ({
  keyboard: entry(
    {
      isModalOpen: Schema.Boolean,
      isRequirements: Schema.Boolean,
      isFindingOpen: Schema.Boolean,
    },
    {
      modelToDependencies: model => ({
        isModalOpen: model.modal._tag !== 'Closed',
        isFindingOpen: Option.isSome(model.maybeOpenFinding),
        isRequirements: model.page === 'Requirements',
      }),
      dependenciesToStream: ({
        isModalOpen,
        isRequirements,
        isFindingOpen,
      }) => {
        const artifactBinding = (
          key: string,
          action: 'Next' | 'Previous' | 'Toggle' | 'Edit',
        ): Subscription.KeyBinding<Message> => ({
          keys: key,
          isEnabled:
            !isModalOpen &&
            (isFindingOpen
              ? action === 'Next' || action === 'Previous'
              : isRequirements),
          mapEvent: () =>
            isFindingOpen && (action === 'Next' || action === 'Previous')
              ? Message.SteppedFinding({ direction: action })
              : Message.PressedArtifactShortcut({ action }),
        })
        return Subscription.keyBindings<Message>({
          bindings: [
            {
              keys: 'Mod+K',
              whileTyping: 'Allow',
              mapEvent: () => Message.PressedCommandPalette(),
            },
            ...pageShortcuts.map(
              ({ page, key }): Subscription.KeyBinding<Message> => ({
                keys: ['G', key],
                isEnabled: !isModalOpen,
                mapEvent: () => Message.PressedPageShortcut({ page }),
              }),
            ),
            artifactBinding('J', 'Next'),
            artifactBinding('K', 'Previous'),
            artifactBinding('X', 'Toggle'),
            artifactBinding('E', 'Edit'),
            {
              keys: '[',
              isEnabled: !isModalOpen,
              mapEvent: () => Message.ToggledSidebar(),
            },
            {
              keys: 'Escape',
              whileTyping: 'Allow',
              isEnabled: isModalOpen || isFindingOpen,
              mapEvent: () =>
                isModalOpen ? Message.ClosedModal() : Message.ClosedFinding(),
            },
            {
              keys: '?',
              isEnabled: !isModalOpen,
              mapEvent: () => Message.ClickedShortcuts(),
            },
          ],
        })
      },
    },
  ),
  navigation: entry(
    { page: Page, isReady: Schema.Boolean },
    {
      modelToDependencies: model => ({
        page: model.page,
        isReady: model.hasLoadedNavigation,
      }),
      dependenciesToStream: ({ page, isReady }) =>
        isReady
          ? Stream.concat(
              Stream.fromEffect(saveNavigation(page)),
              Stream.fromEventListener(window, 'scroll', {
                passive: true,
              }).pipe(
                Stream.debounce('250 millis'),
                Stream.mapEffect(() => saveNavigation(page)),
              ),
            )
          : Stream.empty,
    },
  ),
  toastExit: entry(
    { token: Schema.Number },
    {
      modelToDependencies: model => ({
        token: exitToken(model.maybeLeavingToast),
      }),
      dependenciesToStream: ({ token }) =>
        token < 0
          ? Stream.empty
          : Stream.fromEffect(settleExit('Toast', token)),
    },
  ),
  inspectorExit: entry(
    { token: Schema.Number },
    {
      modelToDependencies: model => ({
        token: exitToken(model.maybeClosingNode),
      }),
      dependenciesToStream: ({ token }) =>
        token < 0
          ? Stream.empty
          : Stream.fromEffect(settleExit('Inspector', token)),
    },
  ),
  modalExit: entry(
    { token: Schema.Number },
    {
      modelToDependencies: model => ({
        token: exitToken(model.maybeClosingModal),
      }),
      dependenciesToStream: ({ token }) =>
        token < 0
          ? Stream.empty
          : Stream.fromEffect(settleExit('Modal', token)),
    },
  ),
  findingExit: entry(
    { token: Schema.Number },
    {
      modelToDependencies: model => ({
        token: exitToken(model.maybeClosingFinding),
      }),
      dependenciesToStream: ({ token }) =>
        token < 0
          ? Stream.empty
          : Stream.fromEffect(settleExit('Finding', token)),
    },
  ),
  userMenu: entry(
    { isOpen: Schema.Boolean },
    {
      modelToDependencies: model => ({ isOpen: model.isUserMenuOpen }),
      dependenciesToStream: ({ isOpen }) =>
        isOpen
          ? Stream.merge(
              Subscription.fromEventFilterMap({
                target: document,
                type: 'pointerdown',
                filterMapEvent: event =>
                  event.target instanceof Element &&
                  !event.target.closest('.profile-menu-root')
                    ? Option.some(Message.ClosedUserMenu())
                    : Option.none(),
              }),
              Subscription.fromEventFilterMap({
                target: document,
                type: 'keydown',
                filterMapEvent: event =>
                  event.key === 'Escape'
                    ? Option.some(Message.ClosedUserMenu())
                    : Option.none(),
              }),
            )
          : Stream.empty,
    },
  ),
  workspaceMenu: entry(
    { isOpen: Schema.Boolean },
    {
      modelToDependencies: model => ({ isOpen: model.isWorkspaceMenuOpen }),
      dependenciesToStream: ({ isOpen }) =>
        isOpen
          ? Stream.merge(
              Subscription.fromEventFilterMap({
                target: document,
                type: 'pointerdown',
                filterMapEvent: event =>
                  event.target instanceof Element &&
                  !event.target.closest('.workspace-menu-root, .crumb-org')
                    ? Option.some(Message.ClosedWorkspaceMenu())
                    : Option.none(),
              }),
              Subscription.fromEventFilterMap({
                target: document,
                type: 'keydown',
                filterMapEvent: event =>
                  event.key === 'Escape'
                    ? Option.some(Message.ClosedWorkspaceMenu())
                    : Option.none(),
              }),
            )
          : Stream.empty,
    },
  ),
  outsidePanel: entry(
    { isOpen: Schema.Boolean },
    {
      modelToDependencies: model => ({
        isOpen:
          model.modal._tag === 'Closed' &&
          (Option.isSome(model.maybeOpenFinding) ||
            Option.isSome(model.maybeSelectedNode)),
      }),
      dependenciesToStream: ({ isOpen }) =>
        isOpen
          ? Subscription.fromEventFilterMap({
              target: document,
              type: 'pointerdown',
              filterMapEvent: event =>
                event.button === 0 &&
                event.target instanceof Element &&
                !event.target.closest(panelSafeZone)
                  ? Option.some(Message.ClickedOutsidePanel())
                  : Option.none(),
            })
          : Stream.empty,
    },
  ),
  graphPan: entry(
    { isPanning: Schema.Boolean },
    {
      modelToDependencies: model => ({
        isPanning: Option.isSome(model.maybeGraphPan),
      }),
      dependenciesToStream: ({ isPanning }) =>
        isPanning
          ? Stream.merge(
              Subscription.fromEvent({
                target: document,
                type: 'pointermove',
                mapEvent: event =>
                  Message.MovedGraphPan({ x: event.clientX, y: event.clientY }),
              }),
              Subscription.fromEvent({
                target: document,
                type: 'pointerup',
                mapEvent: () => Message.ReleasedGraphPan(),
              }),
            )
          : Stream.empty,
    },
  ),
  sidebarTreeResize: entry(
    { isResizing: Schema.Boolean },
    {
      modelToDependencies: model => ({
        isResizing: Option.isSome(model.maybeTreeDrag),
      }),
      dependenciesToStream: ({ isResizing }) =>
        isResizing
          ? Stream.merge(
              Subscription.fromEvent({
                target: document,
                type: 'pointermove',
                mapEvent: event =>
                  Message.MovedTreeHandle({ y: event.clientY }),
              }),
              Subscription.fromEvent({
                target: document,
                type: 'pointerup',
                mapEvent: () => Message.ReleasedTreeHandle(),
              }),
            )
          : Stream.empty,
    },
  ),
  sidebarResize: entry(
    { isResizing: Schema.Boolean },
    {
      modelToDependencies: model => ({ isResizing: model.isResizingSidebar }),
      dependenciesToStream: ({ isResizing }) =>
        isResizing
          ? Stream.merge(
              Subscription.fromEvent({
                target: document,
                type: 'pointermove',
                mapEvent: event =>
                  Message.MovedSidebarHandle({ x: event.clientX }),
              }),
              Subscription.fromEvent({
                target: document,
                type: 'pointerup',
                mapEvent: () => Message.ReleasedSidebarHandle(),
              }),
            )
          : Stream.empty,
    },
  ),
}))

const applyDecision = (
  workspace: Workspace,
  id: string,
  decision: 'Approved' | 'Rejected',
  reason: string,
): Workspace => {
  const approval = workspace.approvals.find(item => item.id === id)
  if (!approval || approval.status !== 'Pending') {
    return workspace
  }
  return record(
    modifyFields(workspace, {
      approvals: approvals =>
        approvals.map(item =>
          item.id === id
            ? modifyFields(item, { status: () => decision })
            : item,
        ),
    }),
    `${approval.title} · ${decision.toLowerCase()} by Dakota Edwards${reason ? ` · ${reason}` : ''}`,
  )
}

const decide = (
  model: Model,
  id: string,
  decision: 'Approved' | 'Rejected',
): UpdateReturn => {
  const approval = model.workspace.approvals.find(item => item.id === id)
  if (!approval || approval.status !== 'Pending') {
    return { model }
  }
  return persist(
    modifyFields(model, {
      stagedDecisions: staged => staged.filter(item => item.id !== id),
    }),
    applyDecision(model.workspace, id, decision, ''),
    `${decision}. Decision recorded in the audit trail; artifacts are unchanged.`,
  )
}

// INIT

export const init: Runtime.ApplicationInit<Model, Message> = () => ({
  model: initialModel,
  commands: [
    LoadWorkspace(),
    LoadSidebarWidth(),
    LoadNavigation(),
    LoadTwinReports(),
    SyncCloudflareCredentials({
      operation: 'Load',
      accountId: initialModel.cloudflareAccountId,
      token: '',
    }),
  ],
})
