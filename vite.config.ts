import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const src = fileURLToPath(new URL('./src', import.meta.url));
// Tauri android dev 通过 TAURI_DEV_HOST 让真机访问开发服务器
const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      { find: '@shared/types', replacement: fileURLToPath(new URL('./shared/types.ts', import.meta.url)) },
      { find: '@messages', replacement: fileURLToPath(new URL('./messages', import.meta.url)) },
      { find: /^@\//, replacement: `${src}/` },
    ],
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: 'ws', host, port: 1421 } : undefined,
  },
  build: { target: 'es2022', outDir: 'dist' },
  test: { environment: 'jsdom', include: ['src/**/*.test.{ts,tsx}'] },
});
