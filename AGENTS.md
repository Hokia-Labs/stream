# Agent Development Notes

This is a Foldkit app. Read [`FOLDKIT.md`](./FOLDKIT.md) before writing any code in this project. It covers the architecture, the APIs, and the conventions the project is built on.

Foldkit owns `FOLDKIT.md` and replaces it whole on upgrade. This file is yours. Anything you want an agent to know about this project goes below, where an upgrade won't touch it.

`FOLDKIT.md` reads the line below to decide whether it has already offered to vendor the Foldkit source. Leave it in place.

subtree_prompted: true

## Project Notes

Domain vocabulary, deployment steps, local conventions that differ from Foldkit's defaults: write them here.

Cloudflare: the Worker is configured by `cloudflare.config.ts` and built/deployed with the `cf` CLI (Vite bundler via `@cloudflare/vite-plugin@beta`). Do not reintroduce Wrangler or `wrangler.jsonc`. `cf` needs Node.js 22.18+ and cannot load the config under Bun. Build Output lives in `.cloudflare/output/v0/`; `worker/runtime.test.ts` loads its bundle into Miniflare. Never run `cf deploy` without explicit approval.

Local backend: `bun run dev:local` (`scripts/dev-local.ts`) patches the built bundle so the AI binding calls a `local-ai` Miniflare worker, which mocks inference or forwards to Workers AI via AI Gateway using credentials the browser saved in localStorage (`stream.cloudflare-ai.v1`) and posted to `/api/local/*`. Those routes exist only in that local wrapper, never in `worker/`. Model: `@cf/zai-org/glm-5.3` (paid Workers AI model).
