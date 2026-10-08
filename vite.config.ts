import { statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import preact from '@preact/preset-vite';
import { defineConfig } from 'vite';
import { serviceWorkerPlugin } from './scripts/service-worker-plugin.ts';

const wasmBytes = statSync(
  fileURLToPath(
    import.meta.resolve('@myriaddreamin/typst-ts-web-compiler/wasm'),
  ),
).size;

export default defineConfig({
  base: process.env.BASE_PATH ?? '/tunadao-relatorios/',
  plugins: [preact(), serviceWorkerPlugin()],
  define: { __WASM_BYTES__: JSON.stringify(wasmBytes) },
  build: { assetsInlineLimit: 0 },
  worker: { format: 'es' },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  optimizeDeps: {
    include: [
      '@myriaddreamin/typst.ts/compiler',
      '@myriaddreamin/typst-ts-web-compiler',
    ],
  },
});
