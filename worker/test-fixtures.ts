import { modifyFields } from 'foldkit/struct'

import { Execution, type Run, TaskSession, seedWorkspace } from '../src/domain'

export const runId = '8c360bf8-c0d5-47d2-a273-4d86610d46dc'
export const fixtureToken = 'local-test-access-token-not-a-real-credential'
export const fixtureRun = (): Run => {
  const agents = seedWorkspace.agents
    .slice(0, 3)
    .map((agent, index) =>
      modifyFields(agent, { wave: () => (index < 2 ? 0 : 1) }),
    )
  return {
    id: 'RUN-test',
    title: 'Review power budget',
    targetId: 'REQ-002',
    status: 'Running',
    execution: Execution.Cloudflare({ runId }),
    wave: 0,
    token: 0,
    pauseAfter: [],
    tasks: agents.map(agent => ({
      agentId: agent.id,
      status: 'Queued',
      output: '',
      session: TaskSession.Pending(),
    })),
    created: 'Workers AI · Pi Durable',
    requirements: seedWorkspace.requirements,
    agents,
  }
}
