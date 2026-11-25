import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

// Short import paths, e.g. import Button from '@shared/components/Button'
// (keep in sync with jsconfig.json so the editor understands them too)
const folder = (path) => fileURLToPath(new URL(path, import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@app': folder('./src/app'),
      '@shared': folder('./src/shared'),
      '@customer': folder('./src/roles/customer'),
      '@rider': folder('./src/roles/rider'),
      '@operator': folder('./src/roles/operator'),
      '@admin': folder('./src/roles/admin'),
      '@mock': folder('./src/mock'),
      '@api': folder('./src/api'),
    },
  },
})
