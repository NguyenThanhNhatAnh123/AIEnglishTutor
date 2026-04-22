import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const root = path.dirname(fileURLToPath(import.meta.url))
const modules = path.resolve(root, 'node_modules')

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      react: path.join(modules, 'react'),
      'react-dom': path.join(modules, 'react-dom'),
      'react/jsx-runtime': path.join(modules, 'react/jsx-runtime.js'),
      'react/jsx-dev-runtime': path.join(modules, 'react/jsx-dev-runtime.js'),
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react/jsx-runtime'],
  },
  server: {
    fs: {
      allow: [root, path.resolve(root, '../packages')],
    },
  },
})
