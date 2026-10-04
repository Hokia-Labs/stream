import { Miniflare, convertV4MiniflareOptions } from 'miniflare'
import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const state = join(root, '.local', 'stream')
const bundle = join(state, 'bundle')
const port = Number(process.env['STREAM_LOCAL_PORT'] ?? '8787')

const run = (command: string, args: ReadonlyArray<string>): Promise<void> =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, stdio: 'inherit' })
    child.on('exit', code =>
      code === 0
        ? resolve()
        : reject(new Error(command + ' exited with ' + String(code))),
    )
  })

const configValue = (config: string, name: string): string => {
  const value = new RegExp(name + ": bindings\\.text\\('([^']+)'\\)").exec(
    config,
  )?.[1]
  if (!value) {
    throw new Error(name + ' is missing from cloudflare.config.ts')
  }
  return value
}

const accessToken = async (): Promise<string> => {
  const path = join(state, 'access-token')
  const saved = await readFile(path, 'utf8').catch(() => '')
  if (saved.trim().length >= 32) {
    return saved.trim()
  }
  const token = randomBytes(24).toString('base64url')
  await writeFile(path, token, { mode: 0o600 })
  return token
}

const localWrapper = String.raw`
const localWrapper = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/local/')) {
      if (request.headers.get('Authorization') !== 'Basic ' + btoa('stream:' + env.STREAM_ACCESS_TOKEN)) {
        return new Response('Unlock Stream first.', { status: 401, headers: { 'WWW-Authenticate': 'Basic realm="Stream", charset="UTF-8"' } });
      }
      return env.LOCAL_AI.fetch(request);
    }
    return originalFetch(request, env, ctx);
  }
};`

const localAI = String.raw`
const credentials = new Map();
const json = (data, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
const validAccount = value => typeof value === 'string' && /^[a-f0-9]{32}$/.test(value);
const validToken = value => typeof value === 'string' && value.length >= 20 && value.length <= 400 && !/\s/.test(value);
const chatUrl = accountId => 'https://api.cloudflare.com/client/v4/accounts/' + accountId + '/ai/v1/chat/completions';
const chat = (env, accountId, token, body, signal) => fetch(chatUrl(accountId), {
  method: 'POST',
  headers: { Authorization: 'Bearer ' + token, 'cf-aig-gateway-id': env.AI_GATEWAY_ID, 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
  signal,
});
const tokenDiagnosis = async (accountId, token) => {
  const verify = async url => {
    const response = await fetch(url, { headers: { Authorization: 'Bearer ' + token }, signal: AbortSignal.timeout(10000) }).catch(() => undefined);
    const data = response ? await response.json().catch(() => undefined) : undefined;
    return data?.success === true ? data.result?.status ?? 'active' : undefined;
  };
  const account = await verify('https://api.cloudflare.com/client/v4/accounts/' + accountId + '/tokens/verify');
  if (account) return ' The token is ' + account + ' as an account token for this account, so it is missing the Workers AI (Read + Edit) or AI Gateway Run permission.';
  const user = await verify('https://api.cloudflare.com/client/v4/user/tokens/verify');
  if (user) return ' The token is ' + user + ' as a user token: confirm it covers account ' + accountId + ' and has Workers AI (Read + Edit) and AI Gateway Run.';
  return ' Cloudflare does not recognise this token for account ' + accountId + '. If it is an account API token, the account ID must be that account.';
};
const cloudflareError = (data, status) => {
  const error = data?.errors?.[0] ?? data?.error;
  const message = typeof error === 'string' ? error : error?.message;
  const hint = status === 401 || status === 403 ? '' : status === 404 ? ' Check the account ID and that the AI Gateway exists.' : '';
  return (message ? message : 'Cloudflare returned HTTP ' + status + '.') + (error?.code ? ' (code ' + error.code + ')' : '') + hint;
};
const replyText = data => {
  const result = data?.result ?? data;
  const content = result?.response ?? result?.choices?.[0]?.message?.content;
  return typeof content === 'string' ? content.trim() : '';
};
const mock = input => {
  const messages = input?.messages ?? [];
  const tool = messages.find(message => message.role === 'tool');
  const prompt = messages.filter(message => message.role === 'user').map(message => typeof message.content === 'string' ? message.content : JSON.stringify(message.content)).join(' ');
  const id = /\b(?:REQ|SYS|DES|INT|TST|RSK|FUN|FN)-[A-Z0-9-]+\b/.exec(prompt)?.[0];
  const artifact = tool ? JSON.parse(tool.content) : undefined;
  const delta = tool || !id
    ? { content: 'Local mock model (no inference). ' + (artifact?.title ? 'Read ' + (artifact.id ?? id) + ' "' + artifact.title + '" from the run snapshot. ' : '') + 'Findings are placeholders; save a Cloudflare token in Settings for real Workers AI. Human review required.' }
    : { tool_calls: [{ index: 0, id: 'artifact-read', type: 'function', function: { name: 'get_artifact', arguments: JSON.stringify({ id }) } }] };
  const events = [
    { choices: [{ index: 0, delta: { role: 'assistant' }, finish_reason: null }] },
    { choices: [{ index: 0, delta, finish_reason: null }] },
    { choices: [{ index: 0, delta: {}, finish_reason: delta.tool_calls ? 'tool_calls' : 'stop' }], usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 } },
  ];
  return new Response(events.map(event => 'data: ' + JSON.stringify(event) + '\n\n').join('') + 'data: [DONE]\n\n', { headers: { 'Content-Type': 'text/event-stream' } });
};
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/local/ai-credentials') {
      if (request.method === 'DELETE') credentials.delete('current');
      if (request.method === 'POST') {
        const body = await request.json().catch(() => undefined);
        if (!validAccount(body?.accountId) || !validToken(body?.token)) return json({ error: 'Enter a 32-character account ID and an API token.' }, 400);
        credentials.set('current', { accountId: body.accountId, token: body.token });
      }
      const current = credentials.get('current');
      return json(current ? { mode: 'WorkersAI', accountId: current.accountId, model: env.AI_MODEL, gateway: env.AI_GATEWAY_ID } : { mode: 'Mock', model: env.AI_MODEL, gateway: env.AI_GATEWAY_ID });
    }
    if (url.pathname === '/api/local/ai-test' && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const stored = credentials.get('current');
      const accountId = validAccount(body?.accountId) ? body.accountId : stored?.accountId;
      const token = validToken(body?.token) ? body.token : stored && stored.accountId === accountId ? stored.token : undefined;
      if (!validAccount(accountId) || !token) return json({ ok: false, latencyMs: 0, detail: 'Enter a 32-character account ID and an API token first.' });
      const started = Date.now();
      try {
        const response = await chat(env, accountId, token, { model: env.AI_MODEL, messages: [{ role: 'user', content: 'Reply with exactly: Stream connection OK' }], max_tokens: 512 }, AbortSignal.timeout(60000));
        const latencyMs = Date.now() - started;
        const text = await response.text();
        const data = (() => { try { return JSON.parse(text); } catch { return undefined; } })();
        if (!response.ok || data?.success === false) {
          const detail = data ? cloudflareError(data, response.status) : 'HTTP ' + response.status + ': ' + text.slice(0, 300);
          return json({ ok: false, latencyMs, detail: response.status === 401 || response.status === 403 ? detail + await tokenDiagnosis(accountId, token) : detail });
        }
        const reply = replyText(data);
        return json({ ok: true, latencyMs, detail: reply ? env.AI_MODEL + ' replied: ' + reply.slice(0, 300) : env.AI_MODEL + ' responded, but returned no text within the token limit.' });
      } catch (error) {
        return json({ ok: false, latencyMs: Date.now() - started, detail: 'Could not reach AI Gateway: ' + (error?.message ?? String(error)) });
      }
    }
    if (url.pathname === '/inference') {
      const call = await request.json();
      const current = credentials.get('current');
      if (!current) return mock(call.input);
      return chat(env, current.accountId, current.token, { ...call.input, model: call.model }, request.signal);
    }
    return json({ error: 'Unknown local AI route.' }, 404);
  }
};`

const assets = String.raw`
export default { fetch() { return new Response('Open the Vite dev server; this port only serves /api.', { status: 404 }); } };`

const prepareBundle = async (): Promise<
  Array<{ type: 'ESModule'; path: string }>
> => {
  await rm(bundle, { recursive: true, force: true })
  await cp(join(root, '.cloudflare/output/v0/workers/default/bundle'), bundle, {
    recursive: true,
  })
  const source = await readFile(join(bundle, 'index.js'), 'utf8')
  const defaultExport = /(\w+) as default/.exec(source)?.[1]
  if (!defaultExport || !source.includes('binding: this.env.AI,')) {
    throw new Error(
      'The Worker bundle no longer matches the local runtime patch.',
    )
  }
  const patched =
    source.replace(
      'binding: this.env.AI,',
      "binding: { run: (model, input, options) => this.env.LOCAL_AI.fetch('http://local-ai/inference', { method: 'POST', body: JSON.stringify({ model, input, gateway: options?.gateway }), signal: options?.signal }) },",
    ) +
    '\nconst originalFetch = ' +
    defaultExport +
    '.fetch;\n' +
    localWrapper +
    '\n' +
    defaultExport +
    '.fetch = localWrapper.fetch;\n'
  await writeFile(join(bundle, 'index.js'), patched)
  const files = await readdir(join(bundle, 'assets')).catch(() => [])
  return [
    { type: 'ESModule', path: join(bundle, 'index.js') },
    ...files
      .filter(file => file.endsWith('.js'))
      .map(file => ({
        type: 'ESModule' as const,
        path: join(bundle, 'assets', file),
      })),
  ]
}

const main = async (): Promise<void> => {
  await mkdir(state, { recursive: true })
  if (!process.argv.includes('--skip-build')) {
    await run('bun', ['run', 'build'])
  }
  const config = await readFile(join(root, 'cloudflare.config.ts'), 'utf8')
  const gateway = configValue(config, 'AI_GATEWAY_ID')
  const model = configValue(config, 'AI_MODEL')
  const token = await accessToken()
  const modules = await prepareBundle()
  const runtime = new Miniflare(
    convertV4MiniflareOptions({
      host: '127.0.0.1',
      port,
      isolatedResourcePersistencePath: join(state, 'data'),
      resourcePersistencePath: join(state, 'data'),
      workers: [
        {
          name: 'stream',
          compatibilityDate: '2026-10-03',
          compatibilityFlags: ['nodejs_compat'],
          modulesRoot: bundle,
          modules,
          bindings: {
            STREAM_ACCESS_TOKEN: token,
            AI_GATEWAY_ID: gateway,
            AI_MODEL: model,
          },
          durableObjects: {
            FLEETS: {
              className: 'Fleet',
              useSQLite: true,
              unsafeUniqueKey: 'stream-local',
            },
          },
          serviceBindings: { LOCAL_AI: 'local-ai', ASSETS: 'local-assets' },
        },
        {
          name: 'local-ai',
          compatibilityDate: '2026-10-03',
          modules: true,
          script: localAI,
          bindings: { AI_GATEWAY_ID: gateway, AI_MODEL: model },
        },
        {
          name: 'local-assets',
          compatibilityDate: '2026-10-03',
          modules: true,
          script: assets,
        },
      ],
    }),
  )
  const url = await runtime.ready
  const vite = spawn(
    join(root, 'node_modules', '.bin', 'vite'),
    [
      '--mode',
      'ui',
      ...process.argv.slice(2).filter(arg => arg !== '--skip-build'),
    ],
    {
      cwd: root,
      stdio: 'inherit',
      env: { ...process.env, STREAM_LOCAL_BACKEND: url.origin },
    },
  )
  console.log(
    [
      '',
      'Stream local backend: ' +
        url.origin +
        ' (Worker, Fleet Durable Object, SQLite in .local/stream/data)',
      'Model: ' +
        model +
        ' via AI Gateway "' +
        gateway +
        '"; mock replies until a Cloudflare token is saved in Settings (your name → Settings).',
      'Unlock in the app with username "stream" and password: ' + token,
      '',
    ].join('\n'),
  )
  const stop = (code: number): void => {
    vite.kill()
    runtime
      .dispose()
      .catch(() => undefined)
      .finally(() => process.exit(code))
  }
  process.on('SIGINT', () => stop(0))
  process.on('SIGTERM', () => stop(0))
  vite.on('exit', code => stop(code ?? 0))
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
