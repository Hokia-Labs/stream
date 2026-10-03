import { Schema } from 'effect'
import { modifyFields } from 'foldkit/struct'

import { Execution, Run } from '../src/domain'
import {
  RunControl,
  maxAgents,
  maxArtifacts,
  maxRequestBytes,
} from '../src/executor'

export interface FleetHandle {
  start(run: Run): Promise<Run>
  snapshot(): Promise<Run | undefined>
  control(action: RunControl): Promise<Run | undefined>
}
export interface WorkerServices {
  readonly accessToken: string | undefined
  readonly publicOrigin: string | undefined
  readonly gateway: string
  readonly model: string
  fleet(id: string): FleetHandle
  assets(request: Request): Promise<Response>
}

const json = (data: unknown, status = 200): Response =>
  Response.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })

export const authorized = async (
  request: Request,
  token: string,
): Promise<boolean> => {
  try {
    const authorization = request.headers.get('Authorization') ?? ''
    if (!authorization.startsWith('Basic ') || authorization.length > 1024) {
      return false
    }
    const actual = atob(authorization.slice(6))
    const encoder = new TextEncoder()
    const [actualHash, expectedHash] = await Promise.all([
      crypto.subtle.digest('SHA-256', encoder.encode(actual)),
      crypto.subtle.digest('SHA-256', encoder.encode(`stream:${token}`)),
    ])
    const expected = new Uint8Array(expectedHash)
    return (
      new Uint8Array(actualHash).reduce(
        (difference, byte, index) =>
          difference | (byte ^ (expected[index] ?? 0)),
        0,
      ) === 0
    )
  } catch {
    return false
  }
}

const readBody = async (request: Request): Promise<string> => {
  if (Number(request.headers.get('Content-Length') ?? '0') > maxRequestBytes) {
    throw new Error('Request exceeds the fleet snapshot size limit.')
  }
  const reader = request.body?.getReader()
  if (!reader) {
    return ''
  }
  const decoder = new TextDecoder()
  const consume = async (text: string, bytes: number): Promise<string> => {
    const chunk = await reader.read()
    if (chunk.done) {
      return text + decoder.decode()
    }
    if (!(chunk.value instanceof Uint8Array)) {
      await reader.cancel()
      throw new Error('Unsupported request encoding.')
    }
    const size = bytes + chunk.value.byteLength
    if (size > maxRequestBytes) {
      await reader.cancel()
      throw new Error('Request exceeds the fleet snapshot size limit.')
    }
    return consume(text + decoder.decode(chunk.value, { stream: true }), size)
  }
  return consume('', 0)
}

export const validateRun = (run: Run): void => {
  const agentIds = new Set(run.agents.map(agent => agent.id))
  const artifactIds = new Set(run.requirements.map(item => item.id))
  if (
    run.agents.length < 1 ||
    run.agents.length > maxAgents ||
    run.requirements.length > maxArtifacts ||
    agentIds.size !== run.agents.length ||
    artifactIds.size !== run.requirements.length ||
    !artifactIds.has(run.targetId)
  ) {
    throw new Error(
      'Choose a valid source and 1–8 unique agents, with at most 200 unique artifacts.',
    )
  }
  if (
    run.agents.some(
      agent => agent.instructions.length > 8000 || agent.id.length > 100,
    ) ||
    JSON.stringify(run.requirements).length > 60_000 ||
    run.title.length > 200 ||
    !run.title.trim()
  ) {
    throw new Error(
      'Agent instructions or artifact context exceed the executor limits.',
    )
  }
}

export const handleRequest = async (
  request: Request,
  services: WorkerServices,
): Promise<Response> => {
  const url = new URL(request.url)
  const configured = Boolean(
    services.accessToken &&
    services.accessToken.length >= 32 &&
    services.gateway &&
    services.model.startsWith('@cf/'),
  )
  const unlocked =
    configured && (await authorized(request, services.accessToken ?? ''))
  if (url.pathname === '/api/executor' && request.method === 'GET') {
    return json({
      state: !configured ? 'Unconfigured' : unlocked ? 'Ready' : 'Locked',
      model: services.model,
      gateway: services.gateway,
    })
  }
  if (!configured) {
    return json(
      {
        error:
          'Configure STREAM_ACCESS_TOKEN (at least 32 characters), AI_GATEWAY_ID, and a Workers AI model on the Worker.',
      },
      503,
    )
  }
  if (!unlocked) {
    return new Response(
      'Unlock Stream using username stream and the workspace access token.',
      {
        status: 401,
        headers: {
          'WWW-Authenticate': 'Basic realm="Stream", charset="UTF-8"',
          'Cache-Control': 'no-store',
        },
      },
    )
  }
  if (url.pathname === '/api/unlock' && request.method === 'GET') {
    return new Response(null, {
      status: 303,
      headers: { Location: '/', 'Cache-Control': 'no-store' },
    })
  }
  if (!url.pathname.startsWith('/api/')) {
    return services.assets(request)
  }
  const route =
    /^\/api\/runs\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})(?:\/(control))?$/.exec(
      url.pathname,
    )
  const id = route?.[1]
  if (!id) {
    return json({ error: 'Unknown executor route.' }, 404)
  }
  const origin = request.headers.get('Origin')
  if (
    request.method !== 'GET' &&
    origin &&
    origin !== url.origin &&
    origin !== services.publicOrigin
  ) {
    return json({ error: 'Cross-origin fleet mutations are not allowed.' }, 403)
  }
  const fleet = services.fleet(id)
  if (request.method === 'GET' && !route?.[2]) {
    const run = await fleet.snapshot()
    return run
      ? json(run)
      : json(
          {
            error:
              'This run has not been dispatched. Retry launch with the same run identifier.',
          },
          404,
        )
  }
  if (
    request.method !== 'POST' ||
    !request.headers.get('Content-Type')?.startsWith('application/json')
  ) {
    return json({ error: 'Use a JSON POST for fleet mutations.' }, 405)
  }
  if (route?.[2]) {
    const action = await readBody(request)
      .then(text => Schema.decodeUnknownSync(RunControl)(JSON.parse(text)))
      .catch(() => undefined)
    if (!action) {
      return json({ error: 'Invalid run control.' }, 400)
    }
    const run = await fleet.control(action)
    return run ? json(run) : json({ pending: true }, 202)
  }
  const run = await readBody(request)
    .then(text => {
      const decoded = Schema.decodeUnknownSync(Run)(JSON.parse(text))
      validateRun(decoded)
      return modifyFields(decoded, {
        execution: () => Execution.Cloudflare({ runId: id }),
        tasks: () =>
          decoded.agents.map(agent => ({
            agentId: agent.id,
            status: 'Queued',
            output: '',
            session: { _tag: 'Pending' },
          })),
      })
    })
    .catch(() => undefined)
  if (!run) {
    return json(
      {
        error:
          'Invalid snapshot. Limit runs to 8 agents, 200 artifacts, and 60,000 characters of artifact context.',
      },
      400,
    )
  }
  try {
    return json(await fleet.start(run), 202)
  } catch {
    return json(
      {
        error:
          'Dispatch failed or this run identifier already has a different snapshot. Reconnect to inspect the durable run before retrying.',
      },
      409,
    )
  }
}
