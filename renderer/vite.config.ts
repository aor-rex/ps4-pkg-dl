import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'

// Single source of truth: root package.json version + CHANGELOG, baked at build time
const rootPkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../package.json'), 'utf8'));
const changelog = fs.readFileSync(path.resolve(__dirname, '../CHANGELOG.md'), 'utf8');

export default defineConfig({
  base: './',
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(rootPkg.version),
    __CHANGELOG_MD__: JSON.stringify(changelog),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'zustand'],
          icons: ['@hugeicons/react', '@hugeicons/core-free-icons'],
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
})
