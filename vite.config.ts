import {resolve} from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        privacy: resolve(__dirname, 'privacy/index.html'),
        "how-to-import": resolve(__dirname, 'how-to-import/index.html'),
      },
    },
  },
  css: {
    modules: {
      localsConvention: 'camelCaseOnly',
    }
  },
})
