import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor:  ['react', 'react-dom', 'react-router-dom'],
          framer:  ['framer-motion'],
          charts:  ['recharts'],
          pdf:     ['pdfjs-dist'],
          sentry:  ['@sentry/react'],
          posthog: ['posthog-js'],
        },
      },
    },
  },
});
