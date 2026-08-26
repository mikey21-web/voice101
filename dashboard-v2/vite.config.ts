import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
        '@xenova/transformers': path.resolve(__dirname, 'node_modules/@huggingface/transformers'),
      },
    },
    worker: { format: 'es' as const },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor': ['react', 'react-dom', 'react-router'],
            'charts': ['recharts'],
            'motion': ['motion', 'framer-motion'],
            'ui': ['@headlessui/react', 'sonner'],
            // lucide-react exports hundreds of named icon components. Left to
            // Rollup's automatic code-splitting, icons get scattered across
            // the ~80 lazy-loaded page chunks inconsistently, which can
            // produce a chunk load-order bug where an icon is referenced
            // before its defining chunk has executed - a runtime
            // "X is not defined" ReferenceError in production only (dev
            // mode serves unbundled ESM, so it never reproduces there).
            // Forcing all icons into one deterministic chunk avoids it.
            'icons': ['lucide-react'],
          },
        },
      },
      chunkSizeWarningLimit: 300,
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify-file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api/, ''),
        },
      },
    },
  };
});
