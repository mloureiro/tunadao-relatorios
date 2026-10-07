import { fileURLToPath } from 'node:url';
import preact from '@preact/preset-vite';
import { defineConfig, type Plugin } from 'vite';
import { patchTypstGlue } from './scripts/lib/typst-glue-patch.ts';

const typstGlue = (): Plugin => ({
  name: 'typst-glue-without-eval',
  enforce: 'pre',
  transform: (code, id) => patchTypstGlue(id, code),
});

export default defineConfig({
  base: process.env.BASE_PATH ?? '/tunadao-relatorios/',
  plugins: [preact(), typstGlue()],
  build: { assetsInlineLimit: 0 },
  worker: { format: 'es', plugins: () => [typstGlue()] },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
});
