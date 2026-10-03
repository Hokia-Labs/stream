import { defineConfig } from 'vite'

import { cloudflare } from '@cloudflare/vite-plugin'
import { foldkit } from '@foldkit/vite-plugin'
import tailwindcss from '@tailwindcss/vite'

const localBackend = process.env['STREAM_LOCAL_BACKEND']

export default defineConfig(({ mode }) => ({
  plugins: [tailwindcss(), foldkit(), ...(mode === 'ui' ? [] : [cloudflare()])],
  ...(localBackend
    ? {
        server: {
          proxy: {
            '/api': {
              target: localBackend,
              changeOrigin: true,
              configure: proxy => {
                proxy.on('proxyReq', request => {
                  request.removeHeader('origin')
                })
              },
            },
          },
        },
      }
    : {}),
  optimizeDeps: {
    entries: ['src/entry.ts'],
  },
}))
