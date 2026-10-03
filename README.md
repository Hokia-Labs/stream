# Stream

A connected engineering workspace built with Foldkit, Effect, and typed HTML (not React/JSX).

## Workspace

- Requirements, systems, functions, designs, tests, and interfaces share one dependency graph.
- Table, collapsible Tree, and Reader views share search and filters.
- Hierarchical sidebar and Table, graph Tree, and Reader views share one selection.
- Hide table fields, search/filter artifacts, and import/export workspace JSON.
- Branch edits remain separate from Base; review diffs and approve non-conflicting changes before merging. New edits invalidate approval.
- Configure agent instructions, enabled state, and execution stages; inspect run snapshots and human decisions.
- Workspace changes persist locally, export as JSON, and produce a reviewable audit trail.

Execution has two explicit modes: **Cloudflare** runs Workers AI models through the `stream` AI Gateway and the experimental durable Pi harness; **Simulation** runs deterministic local checks without model calls. Cloudflare mode uses agent instructions and read-only snapshot tools. Simulation saves instructions but does not execute them. Failed Cloudflare runs never silently become simulated results. Integration cards do not authenticate or modify other external services; provider credentials are never stored in browser state.

Branch review is a **local workspace-owner decision**, not an authenticated multi-user permission system. Import replaces local data and pauses unfinished runs. Graph rendering currently uses Foldkit HTML cards with SVG edges and a dependency-depth layout, not a graph visualization library.

### Flow reference boundary

The visual references are Flow's public product screenshots and documentation, not its private application. Stream implements the core artifact, branch, agent-configuration, run, and review workflows, plus a Cloudflare executor. It does **not** implement CAD/simulation tool execution, OAuth connectors, spreadsheet range editing, scheduled automations, multi-user review permissions, or deleted-item recovery. Exact private-product parity is not claimed.

Saved work from the earlier product name is still loaded automatically. New saves use `stream.workspace.v1`.

## Getting Started

Use Bun **1.4.2** to install dependencies and run package scripts. Vite and
Vitest run on Node; use Node 24 LTS (Node 24.20.0 was verified). The supported
Node range is `^20.19.0 || >=22.12.0`.

Install the pinned Bun release on macOS with an existing Node/npm installation:

```bash
npm install --global bun@1.4.2
bun --version # 1.4.2
bun install --frozen-lockfile
bun run dev
```

`bun.lock` is the canonical dependency lockfile. Do not use `npm install` or
maintain a second package-manager lockfile. If migrating an older scaffold,
remove its obsolete `package-lock.json` once `bun.lock` is in place. Use
`bun install --frozen-lockfile` in clean checkouts and CI; after intentionally
changing dependencies, run `bun install` and include the updated lockfile.

## Cloudflare Executor (Experimental)

The frontend calls `/api`; a Cloudflare Worker serves both the built app and the
authenticated API. One SQLite-backed `Fleet` Durable Object coordinates each run.
Each enabled agent gets a durable Pi session: agents run in parallel within a
stage, and later stages receive earlier findings. Transcripts, tools, inboxes,
tasks, and coordinator state persist in Durable Object SQLite. Repeated dispatch
of the same immutable snapshot reuses the run and deterministic operation IDs.

The executor uses `PiHarness` from `agents/harness/pi`,
`@earendil-works/pi-durable`, and `@earendil-works/pi-ai`. These harness APIs are
experimental; pin versions and validate recovery before production use.

### Configuration

`cloudflare.config.ts` (Cloudflare's typed configuration, open beta) configures
the Moneywell account, the `AI` Workers AI binding, `FLEETS`, static assets, secrets, and the
SQLite-backed `Fleet` Durable Object export. The `cf` CLI builds it with Vite and
the Cloudflare Vite plugin beta; Wrangler is not used. `cf` loads the config with
Node.js 22.18+ (Bun cannot load it); `bun run` scripts call the Node `cf` binary.

| Setting               | Purpose                                                                                       |
| --------------------- | --------------------------------------------------------------------------------------------- |
| `AI_GATEWAY_ID`       | Existing gateway ID; defaults to the dedicated authenticated `stream` gateway                 |
| `AI_MODEL`            | Workers AI model; defaults to `@cf/zai-org/glm-5.3`                                           |
| `STREAM_ACCESS_TOKEN` | Required random Worker secret, at least 32 characters; never a public frontend variable       |
| `PUBLIC_ORIGIN`       | Optional trusted frontend origin; use `http://localhost:5173` only for local Vite development |

The `stream` gateway already exists in the configured account. Workers AI binding
requests use the account identity and include the gateway server-side; no
Cloudflare API token or gateway secret is sent to the browser.

### Local backend without a Cloudflare login

`bun run dev:local` builds the Worker, runs it in Miniflare (the real router,
`Fleet` Durable Object, SQLite and Pi Durable harness) on `127.0.0.1:8787`, and
starts Vite with `/api` proxied to it. Extra arguments go to Vite, e.g.
`bun run dev:local -- --host 0.0.0.0 --port 5173`; `--skip-build` reuses the
last build. State lives in the ignored `.local/stream/`, and the printed access
token unlocks the app (username `stream`).

Model calls are mocked until a Cloudflare account ID and API token are saved on
**Integrations → Cloudflare credentials**. Those are stored in the browser's
localStorage only (never in the workspace or exports) and pushed to the local
backend, which keeps them in memory and calls Workers AI through the `stream` AI
Gateway (`gateway.ai.cloudflare.com/.../workers-ai/<model>`). **Test connection**
sends one short prompt to verify the token. This is a demo convenience: the
deployed Worker never accepts browser-supplied credentials.

For local Worker development with `cf dev`:

1. Authenticate with `cf auth login` (or set `CLOUDFLARE_API_TOKEN`). `cf dev`
   needs it because the Workers AI binding always runs remotely. This is separate
   from Devin's Cloudflare integration.
2. Create an ignored `.dev.vars` containing your own random
   `STREAM_ACCESS_TOKEN`. Set `PUBLIC_ORIGIN=http://localhost:5173` if using Vite.
   Do not use the test fixture token or commit this file.
3. Run `bun run dev` (`cf dev`). Vite serves the app with hot reload and runs the
   Worker in local workerd on the same origin, so `/api` needs no proxy. Without
   Cloudflare credentials, `bun run dev:ui` serves only the frontend; use
   **Simulation** there.
4. In Stream, select **Cloudflare** and **Unlock Worker**. Use username `stream`
   and your access token as the password in the browser's native Basic-auth prompt.
   Probe the executor, then launch once it reports ready.

Local Workers AI requests can still use Cloudflare's hosted models and incur
billing. Use **Simulation** for an offline preview. `bun run test` instead uses
fake inference in local workerd, without live Cloudflare model calls.

Production must use your official release pipeline. `cf deploy` builds and uploads
the Worker and assets; pass `--secrets-file` to upload `STREAM_ACCESS_TOKEN` with the
version. `bun run deploy:check` is `cf deploy --dry-run`: it builds and validates the
bindings without credentials or uploads.

**Verification boundary:** local workerd/Pi tests exercise tool execution,
stage ordering, hold/resume, schedule deduplication, and SQLite restart recovery
using a fake AI binding. No Worker deployment or live Workers AI inference has
been verified. Authentication, model availability, billing, and gateway behavior
must be checked in the target environment.

### Controls and safety

- **Hold** prevents the next stage from starting; active model calls may finish.
- **Resume** continues from the persisted snapshot.
- **Cancel** persists cancellation intent and aborts Pi sessions; failed aborts
  are retried rather than reported as completed cancellation.
- Limits: 8 agents, 2,048 output tokens per generation, 8 generations per agent
  operation, 2 Pi retries, 45-second provider timeout, and a 10-minute run deadline.
- Only `get_artifact` and `downstream_impact` are exposed, both read-only and safe
  to replay. No shell, arbitrary network, filesystem, or external-write tools.
- Findings create a human review item, not an automatic artifact change or merge.
- The API requires Basic authentication, enforces mutation origins and snapshot
  limits, caps bodies at 512 KB, and redacts provider errors.
- Basic authentication is a shared owner-level launch gate, not multi-user
  authorization. Use HTTPS outside local development and protect the secret.
  Native browser authentication can retain it; Foldkit state and workspace JSON
  do not store it.

Routes: `GET /api/executor`, `GET /api/unlock`, `POST /api/runs/:uuid`,
`GET /api/runs/:uuid`, and `POST /api/runs/:uuid/control` with a JSON string
`"Hold"`, `"Resume"`, or `"Cancel"`.

References: [Cloudflare Pi harness](https://developers.cloudflare.com/agents/harnesses/pi/)
and [Workers AI with AI Gateway](https://developers.cloudflare.com/ai-gateway/providers/workersai/).

## Quality Gates

```bash
bun run check
```

The combined gate stops on the first failure and runs type checking, linting,
format checking, tests, the `cf build` (frontend and Worker), and the `cf deploy`
dry run, in that order.

| Command                | Purpose                                                                     |
| ---------------------- | --------------------------------------------------------------------------- |
| `bun run typecheck`    | Strict TypeScript 7 checking of frontend, Worker, tests, and tool configs   |
| `bun run lint`         | Type-aware Oxlint, Foldkit conventions, and zero allowed warnings           |
| `bun run lint:fix`     | Apply safe lint fixes, then report remaining diagnostics                    |
| `bun run format`       | Format the project with Oxfmt                                               |
| `bun run format:check` | Non-mutating Oxfmt formatting gate                                          |
| `bun run test`         | Run Foldkit, coordinator, HTTP, and local workerd/Pi tests                  |
| `bun run build`        | `cf build`: app and Worker Build Output in `.cloudflare/output/v0/`         |
| `bun run preview`      | Serve the production build locally                                          |
| `bun run dev`          | `cf dev`: Vite with hot reload plus the local Worker                        |
| `bun run dev:ui`       | Frontend only, no Worker or Cloudflare credentials (Simulation mode)        |
| `bun run dev:local`    | Miniflare Worker + Vite proxy; mock model or browser-saved Workers AI token |
| `bun run deploy:check` | `cf deploy --dry-run`: validate bindings without uploading                  |

Keep **Vitest** as the test runner: `bun run test` invokes `vitest run`.
Do not substitute `bun test`; Foldkit's setup targets Vitest. Missing tests
fail the gate rather than silently passing. Tests belong under `src/` and
`worker/` with `.test.ts` or `.spec.ts` filenames. Worker HTTP and runtime tests
use Node; UI tests use happy-dom. Runtime tests build the frontend and Worker,
then start local workerd with SQLite and fake inference.

### Pinned Toolchain

| Tool                  | Version                             |
| --------------------- | ----------------------------------- |
| Bun                   | 1.4.2                               |
| TypeScript            | 7.0.2                               |
| Oxlint                | 1.85.0                              |
| oxlint-tsgolint       | 7.0.2003 (TypeScript 7.0.2 backend) |
| Oxfmt                 | 0.66.0                              |
| Vite                  | 8.3.1                               |
| Vitest                | 5.0.2                               |
| Foldkit               | 0.165.0                             |
| Foldkit Oxlint plugin | 0.15.1                              |

TypeScript enables `strict`, `noUncheckedIndexedAccess`,
`exactOptionalPropertyTypes`, unused-local/parameter checks,
`noImplicitReturns`, `noFallthroughCasesInSwitch`,
`useUnknownInCatchVariables`, `isolatedModules`, and `verbatimModuleSyntax`.
Use `import type` (or inline `type`) for type-only imports. Intentional unused
parameters can start with `_`. Dependency declaration checking remains skipped;
application source, tests, and both TypeScript configs are checked.

Oxlint enables the **correctness**, **suspicious**, and **perf** categories as
errors, retains Foldkit's recommended plugin and its test/entry overrides,
and checks source/tests and tool configs. Explicit TypeScript rules cover unsafe
arguments/assignments/calls/member access/returns/assertions, floating or misused
promises, invalid `await`, unbound methods, thrown/rejected values, type-only
imports, and generic `Array<T>` syntax. Promise, import, Unicorn, Oxc, and Vitest
plugins provide additional checks. React and JSX plugins are not enabled.
`_tag` is allowed by the underscore-name rule because Effect/Foldkit use it for
discriminated unions. Unused suppression directives fail lint.

Oxfmt preserves the scaffold's no-semicolon/single-quote/import-order style.
Generated output, dependencies, vendored references, and package-manager
lockfiles are excluded; source and tests are not.

## Learn More

- [Foldkit Documentation](https://foldkit.dev)
- [Effect Documentation](https://effect.website)
