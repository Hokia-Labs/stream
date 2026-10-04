import { Array, Effect, Schema } from 'effect'
import { defineTaggedUnion } from 'foldkit/schema'

export const Page = Schema.Literals([
  'Overview',
  'Digital twin',
  'Systems graph',
  'Requirements',
  'Agent fleet',
  'Runs',
  'Integrations',
  'Branches',
])
export type Page = typeof Page.Type
export const SortKey = Schema.Literals([
  'Artifact',
  'Type',
  'Status',
  'Owner',
  'Links',
  'Revision',
])
export type SortKey = typeof SortKey.Type
export const SortDirection = Schema.Literals(['Ascending', 'Descending'])
export type SortDirection = typeof SortDirection.Type
export const stageNames: ReadonlyArray<string> = [
  'Discover',
  'Evaluate',
  'Coordinate',
]
export const ArtifactView = Schema.Literals(['Table', 'Tree', 'Reader'])
export type ArtifactView = typeof ArtifactView.Type
export const ArtifactField = Schema.Literals([
  'Type',
  'Status',
  'Owner',
  'Links',
  'Revision',
])
export type ArtifactField = typeof ArtifactField.Type
export const Requirement = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  description: Schema.String,
  kind: Schema.Literals([
    'Requirement',
    'System',
    'Function',
    'Design',
    'Test',
    'Interface',
    'Risk',
  ]),
  status: Schema.Literals(['Verified', 'Needs review', 'Draft']),
  owner: Schema.String,
  links: Schema.Array(Schema.String),
  revision: Schema.Number,
})
export type Requirement = typeof Requirement.Type
export const AgentWave = Schema.Literals([0, 1, 2])
export type AgentWave = typeof AgentWave.Type
export const Agent = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  description: Schema.String,
  category: Schema.String,
  instructions: Schema.String,
  enabled: Schema.Boolean,
  wave: AgentWave,
  color: Schema.String,
})
export type Agent = typeof Agent.Type
export const RunView = Schema.Literals(['Matrix', 'Timeline', 'Trace'])
export type RunView = typeof RunView.Type
export const LaunchScope = Schema.Literals(['Workspace', 'Impact'])
export type LaunchScope = typeof LaunchScope.Type
export const ReviewDecision = Schema.Struct({
  id: Schema.String,
  decision: Schema.Literals(['Approved', 'Rejected']),
  reason: Schema.String,
})
export type ReviewDecision = typeof ReviewDecision.Type

export const TwinFocus = Schema.Literals(['Airframe', 'Aft bay', 'Cockpit'])
export type TwinFocus = typeof TwinFocus.Type

export const TwinSlot = Schema.Literals(['Cockpit', 'Power'])
export type TwinSlot = typeof TwinSlot.Type
export const TwinRevision = Schema.Literals(['A', 'B'])
export type TwinRevision = typeof TwinRevision.Type
export const TwinProposal = Schema.Literals([
  'None',
  'Drafting',
  'Pending',
  'Rejected',
  'Approved',
])
export type TwinProposal = typeof TwinProposal.Type
export const TwinCheck = Schema.Literals(['Not run', 'Running', 'Done'])
export const BoardReviewTab = Schema.Literals([
  'PDR',
  'Schematic',
  '3D model',
  'Thermal',
])
export type BoardReviewTab = typeof BoardReviewTab.Type

export const TwinDesignChange = Schema.Struct({
  part: Schema.String,
  before: Schema.String,
  after: Schema.String,
  trace: Schema.String,
})
export type TwinDesignChange = typeof TwinDesignChange.Type

export const TwinDesignField = Schema.Literals([
  'part',
  'before',
  'after',
  'trace',
])
export type TwinDesignField = typeof TwinDesignField.Type

export const TwinPdrUpload = Schema.Struct({
  name: Schema.String,
  size: Schema.Number,
  maybeText: Schema.Option(Schema.String),
})
export type TwinPdrUpload = typeof TwinPdrUpload.Type
export type TwinCheck = typeof TwinCheck.Type
export const TwinReviewItem = Schema.Literals([
  'Requirements',
  'Thermal',
  'Mechanical',
])
export type TwinReviewItem = typeof TwinReviewItem.Type
export const TwinPackage = Schema.Struct({
  name: Schema.String,
  digest: Schema.String,
  bytes: Schema.Number,
  files: Schema.Array(Schema.String),
  isSent: Schema.Boolean,
})
export type TwinPackage = typeof TwinPackage.Type
export const TwinReport = Schema.Struct({
  name: Schema.String,
  content: Schema.String,
  isEdited: Schema.Boolean,
})
export type TwinReport = typeof TwinReport.Type
export const TwinReportSync = Schema.Literals([
  'Local',
  'Saving',
  'Saved',
  'Failed',
])
export type TwinReportSync = typeof TwinReportSync.Type
export const GraphPreviewTab = Schema.Literals(['Inputs', 'Output', 'Settings'])
export type GraphPreviewTab = typeof GraphPreviewTab.Type
export const GraphView = Schema.Literals(['Graph', 'Matrix'])
export type GraphView = typeof GraphView.Type
export const GraphScope = Schema.Literals(['1 hop', '2 hops', 'All'])
export type GraphScope = typeof GraphScope.Type
export const ArtifactKind = Requirement.fields.kind
export type ArtifactKind = typeof ArtifactKind.Type
export const GroupBy = Schema.Literals(['None', 'Status', 'Owner', 'Type'])
export type GroupBy = typeof GroupBy.Type

export const SavedView = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  filter: Schema.String,
  search: Schema.String,
  groupBy: GroupBy,
  sort: Schema.Literals([
    'None',
    'Artifact',
    'Type',
    'Status',
    'Owner',
    'Links',
    'Revision',
  ]),
  direction: SortDirection,
})
export type SavedView = typeof SavedView.Type
export const ExecutionMode = Schema.Literals(['Cloudflare', 'Simulation'])
export type ExecutionMode = typeof ExecutionMode.Type
export const Execution = defineTaggedUnion({
  Simulation: {},
  Preparing: {},
  Cloudflare: { runId: Schema.String },
})
export const TaskSession = defineTaggedUnion({
  Pending: {},
  Pi: { id: Schema.String },
})
export const Task = Schema.Struct({
  agentId: Schema.String,
  status: Schema.Literals([
    'Queued',
    'Running',
    'Completed',
    'Failed',
    'Cancelled',
  ]),
  output: Schema.String,
  session: TaskSession.pipe(
    Schema.withDecodingDefaultKey(Effect.succeed(TaskSession.Pending())),
  ),
})
export type Task = typeof Task.Type
export const Run = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  targetId: Schema.String,
  status: Schema.Literals([
    'Running',
    'Paused',
    'Completed',
    'Cancelling',
    'Cancelled',
    'Failed',
  ]),
  execution: Execution.pipe(
    Schema.withDecodingDefaultKey(Effect.succeed(Execution.Simulation())),
  ),
  wave: Schema.Number,
  token: Schema.Number,
  tasks: Schema.Array(Task),
  created: Schema.String,
  requirements: Schema.Array(Requirement),
  agents: Schema.Array(Agent),
  pauseAfter: Schema.Array(Schema.Number).pipe(
    Schema.withDecodingDefaultKey(Effect.succeed([])),
  ),
})
export type Run = typeof Run.Type
export const Approval = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  detail: Schema.String,
  targetId: Schema.String,
  agentId: Schema.String,
  status: Schema.Literals(['Pending', 'Approved', 'Rejected']),
  runId: Schema.String,
})
export type Approval = typeof Approval.Type
export const Branch = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  status: Schema.Literals(['Draft', 'Merged']),
  reviewStatus: Schema.Literals(['Pending', 'Approved', 'Rejected']).pipe(
    Schema.withDecodingDefaultKey(Effect.succeed('Pending')),
  ),
  base: Schema.Array(Requirement),
  requirements: Schema.Array(Requirement),
})
export type Branch = typeof Branch.Type
export const Workspace = Schema.Struct({
  version: Schema.Literal(1),
  requirements: Schema.Array(Requirement),
  agents: Schema.Array(Agent),
  runs: Schema.Array(Run),
  approvals: Schema.Array(Approval),
  events: Schema.Array(Schema.String),
  branches: Schema.Array(Branch).pipe(
    Schema.withDecodingDefaultKey(Effect.succeed([])),
  ),
  views: Schema.Array(SavedView).pipe(
    Schema.withDecodingDefaultKey(Effect.succeed([])),
  ),
  nextId: Schema.Number,
})
export type Workspace = typeof Workspace.Type
export const Modal = defineTaggedUnion({
  Closed: {},
  RequirementEditor: {
    id: Schema.String,
    title: Schema.String,
    description: Schema.String,
    kind: Requirement.fields.kind,
    owner: Schema.String,
    links: Schema.Array(Schema.String),
  },
  AgentEditor: {
    id: Schema.String,
    name: Schema.String,
    instructions: Schema.String,
    wave: AgentWave,
  },
  RunLauncher: {
    targetId: Schema.String,
    title: Schema.String,
    scope: LaunchScope,
    launchAnother: Schema.Boolean,
  },
  BranchEditor: { title: Schema.String },
  IntegrationDetails: { name: Schema.String },
  ArtifactFields: {},
  WorkspaceImporter: { jsonText: Schema.String },
  CommandPalette: { query: Schema.String, index: Schema.Number },
  Shortcuts: {},
  PartPicker: { slot: TwinSlot, selectedId: Schema.String },
  BoardReview: { tab: BoardReviewTab },
})
export type Modal = typeof Modal.Type

export const seedWorkspace: Workspace = {
  version: 1,
  nextId: 12,
  branches: [],
  views: [
    {
      id: 'VIEW-1',
      name: 'Needs review by owner',
      filter: 'Needs review',
      search: '',
      groupBy: 'Owner',
      sort: 'None',
      direction: 'Ascending',
    },
    {
      id: 'VIEW-2',
      name: 'Tests by status',
      filter: 'Test',
      search: '',
      groupBy: 'Status',
      sort: 'Revision',
      direction: 'Descending',
    },
  ],
  requirements: [
    {
      id: 'REQ-001',
      title: 'Atlas autonomous platform',
      description:
        'The Atlas platform shall operate autonomously for a minimum of 8 hours within the defined operating envelope.',
      kind: 'Requirement',
      status: 'Verified',
      owner: 'Ben Juntilla',
      links: ['REQ-002', 'REQ-003', 'REQ-004'],
      revision: 3,
    },
    {
      id: 'REQ-002',
      title: 'Power & endurance',
      description:
        'Battery subsystem shall provide 8 hours of operation at nominal load. System mass shall not exceed 24 kg.',
      kind: 'Requirement',
      status: 'Needs review',
      owner: 'Sarah Chen',
      links: ['DES-001', 'TST-001'],
      revision: 2,
    },
    {
      id: 'REQ-003',
      title: 'Navigation accuracy',
      description:
        'Position estimation error shall remain below 0.5 m under normal operating conditions.',
      kind: 'Requirement',
      status: 'Verified',
      owner: 'Alex Rivera',
      links: ['DES-002', 'TST-002'],
      revision: 4,
    },
    {
      id: 'REQ-004',
      title: 'Safe-state behavior',
      description:
        'The system shall enter a safe state within 200 ms of a critical fault. Every fault path requires a verification artifact.',
      kind: 'Requirement',
      status: 'Verified',
      owner: 'Jordan Lee',
      links: ['INT-001', 'TST-002'],
      revision: 2,
    },
    {
      id: 'DES-001',
      title: 'Battery pack assembly',
      description:
        'Revision C: updated enclosure and 48 V battery architecture. Proposed mass increase of 180 g requires budget review.',
      kind: 'Design',
      status: 'Needs review',
      owner: 'Sarah Chen',
      links: ['INT-001'],
      revision: 3,
    },
    {
      id: 'DES-002',
      title: 'Sensor fusion pipeline',
      description:
        'Fuses LiDAR, IMU, and GNSS observations for robust localization.',
      kind: 'Design',
      status: 'Verified',
      owner: 'Alex Rivera',
      links: ['INT-001'],
      revision: 2,
    },
    {
      id: 'INT-001',
      title: 'Control bus interface',
      description:
        'CAN-FD interface connects power, navigation, and safe-state controllers.',
      kind: 'Interface',
      status: 'Verified',
      owner: 'Jordan Lee',
      links: [],
      revision: 1,
    },
    {
      id: 'TST-001',
      title: 'Endurance validation',
      description:
        'Validate runtime across nominal and peak loads. Latest enclosure revision needs a new evidence artifact.',
      kind: 'Test',
      status: 'Draft',
      owner: 'Sarah Chen',
      links: [],
      revision: 1,
    },
    {
      id: 'TST-002',
      title: 'Fault injection suite',
      description:
        'Verify navigation degradation and safe-state response under injected sensor and bus faults.',
      kind: 'Test',
      status: 'Verified',
      owner: 'Jordan Lee',
      links: [],
      revision: 5,
    },
  ],
  agents: [
    {
      id: 'impact',
      name: 'Impact analyst',
      description: 'Every change. Every dependency. No surprises.',
      category: 'Change intelligence',
      instructions:
        'Traverse upstream and downstream dependencies. Identify affected artifacts and explain which owners should review each change.',
      enabled: true,
      wave: 0,
      color: 'mint',
    },
    {
      id: 'coverage',
      name: 'Verification agent',
      description: 'Connect requirements to evidence, not assumptions.',
      category: 'Quality & verification',
      instructions:
        'Check every requirement for linked verification artifacts. Report missing coverage and stale evidence.',
      enabled: true,
      wave: 0,
      color: 'blue',
    },
    {
      id: 'budget',
      name: 'Budget guardian',
      description: 'Keep mass, power, and cost inside the envelope.',
      category: 'Program constraints',
      instructions:
        'Review affected requirements for mass, power, and cost constraints. Flag revisions that need engineering sign-off. Never invent numerical compliance results.',
      enabled: true,
      wave: 1,
      color: 'violet',
    },
    {
      id: 'safety',
      name: 'Safety & compliance',
      description: 'A second pair of eyes on your highest stakes.',
      category: 'Risk & compliance',
      instructions:
        'Review safety requirements and their verification links. Flag unverified failure modes. Do not claim certification or regulatory compliance.',
      enabled: true,
      wave: 1,
      color: 'orange',
    },
    {
      id: 'docs',
      name: 'Documentation agent',
      description: 'Keep the system of record in step with the work.',
      category: 'Knowledge & traceability',
      instructions:
        'Produce a concise change summary, affected artifact list, and owner handoff for review.',
      enabled: true,
      wave: 2,
      color: 'pink',
    },
    {
      id: 'review',
      name: 'Review coordinator',
      description: 'Route the right decisions to the right humans.',
      category: 'Human in the loop',
      instructions:
        'Summarize findings from earlier agents and prepare review requests. Require explicit human approval before changing an artifact status.',
      enabled: true,
      wave: 2,
      color: 'teal',
    },
  ],
  runs: [],
  approvals: [
    {
      id: 'APR-001',
      title: 'Review battery pack revision C',
      detail:
        'The enclosure revision adds 180 g. Confirm the revised mass budget before accepting the design.',
      targetId: 'DES-001',
      agentId: 'budget',
      status: 'Pending',
      runId: 'Sample finding',
    },
    {
      id: 'APR-002',
      title: 'Refresh endurance test evidence',
      detail:
        'The power subsystem changed, but its endurance verification artifact has not been updated.',
      targetId: 'TST-001',
      agentId: 'coverage',
      status: 'Pending',
      runId: 'Sample finding',
    },
  ],
  events: [
    'Sample workspace created · Atlas launch program',
    'Battery pack revision C linked to power requirements',
    'Verification evidence flagged for engineering review',
  ],
}

export const downstream = (
  requirements: ReadonlyArray<Requirement>,
  id: string,
): ReadonlyArray<string> => {
  const visit = (
    frontier: ReadonlyArray<string>,
    seen: ReadonlyArray<string>,
  ): ReadonlyArray<string> => {
    const fresh = Array.dedupe(frontier.filter(item => !seen.includes(item)))
    if (Array.isArrayEmpty(fresh)) {
      return seen
    }
    return visit(
      requirements
        .filter(item => fresh.includes(item.id))
        .flatMap(item => item.links),
      seen.concat(fresh),
    )
  }
  return visit([id], []).filter(item => item !== id)
}

export const agentOutput = (
  workspace: Workspace,
  run: Run,
  agentId: string,
): string => {
  const target = workspace.requirements.find(item => item.id === run.targetId)
  const affected = downstream(workspace.requirements, run.targetId)
  const evidence = workspace.requirements.filter(
    item => affected.includes(item.id) && item.kind === 'Test',
  )
  const uncovered = workspace.requirements.filter(
    item =>
      [run.targetId, ...affected].includes(item.id) &&
      item.kind === 'Requirement' &&
      !downstream(workspace.requirements, item.id).some(id =>
        workspace.requirements.some(
          test => test.id === id && test.kind === 'Test',
        ),
      ),
  )
  const outputs: Readonly<Record<string, string>> = {
    impact: `Dependency traversal complete. ${affected.length} downstream artifacts affected by ${run.targetId}: ${affected.join(', ') || 'none'}. Engineering review is required before propagation.`,
    coverage: `${evidence.length} connected verification artifacts found. ${uncovered.length} requirements without a downstream test. ${evidence.filter(item => item.status !== 'Verified').length} test artifacts lack verified evidence.`,
    budget: `Constraint review prepared for ${target?.title ?? run.targetId}. ${target?.description ?? ''} Numerical budget compliance requires real engineering data; no compliance result is inferred.`,
    safety: `Safety review covers ${affected.length + 1} artifacts. Connected safety requirements and fault-test evidence should be reviewed by an engineer. This simulation does not certify compliance.`,
    docs: `Change brief: ${run.title}. Source: ${run.targetId}, revision ${target?.revision ?? 1}. Notify ${Array.dedupe(workspace.requirements.filter(item => [run.targetId, ...affected].includes(item.id)).map(item => item.owner)).join(', ')}.`,
    review: `Review package ready. ${run.tasks.filter(task => task.status === 'Completed').length} earlier checks completed. A human approval is required; no artifact is changed automatically.`,
  }
  return (
    outputs[agentId] ??
    `Custom agent queued a review for ${run.targetId}. Saved instructions are configuration only in simulation mode; connect a live executor to interpret them.`
  )
}

export const CloudflareAiMode = Schema.Literals([
  'Unknown',
  'Mock',
  'WorkersAI',
  'Locked',
  'Unavailable',
])
export type CloudflareAiMode = typeof CloudflareAiMode.Type
export const CloudflareTest = Schema.Struct({
  state: Schema.Literals(['Testing', 'Passed', 'Failed']),
  detail: Schema.String,
  latencyMs: Schema.Number,
})
export type CloudflareTest = typeof CloudflareTest.Type
export const validCloudflareAccountId = (value: string): boolean =>
  /^[a-f0-9]{32}$/.test(value.trim())
export const validCloudflareToken = (value: string): boolean =>
  value.trim().length >= 20 && value.trim().length <= 400
