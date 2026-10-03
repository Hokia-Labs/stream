import { bindings, defineConfig, exports } from 'cf/config'

export default defineConfig({
  accountId: '3d275686d20e190931adbada39b35957',
  worker: {
    name: 'stream',
    entrypoint: './worker/index.ts',
    compatibilityDate: '2026-10-03',
    compatibilityFlags: ['nodejs_compat'],
    assets: {
      notFoundHandling: 'single-page-application',
      runWorkerFirst: true,
    },
    exports: {
      Fleet: exports.durableObject({ storage: 'sqlite' }),
    },
    env: {
      AI: bindings.ai(),
      ASSETS: bindings.assets(),
      FLEETS: bindings.durableObject({ worker: 'stream', exportName: 'Fleet' }),
      AI_GATEWAY_ID: bindings.text('stream'),
      AI_MODEL: bindings.text('@cf/zai-org/glm-5.3'),
      STREAM_ACCESS_TOKEN: bindings.secret(),
    },
  },
})
