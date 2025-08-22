import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

export default defineConfig({
  plugins: [
    // Custom dev routing plugin
    {
      name: 'dev-routing',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === '/') {
            // Serve landing page at root during development
            req.url = '/index.html';
          } else if (req.url?.startsWith('/manage') && !req.url.includes('.')) {
            // Serve React app for /manage routes during development
            req.url = '/app.html';
          }
          next();
        });
      },
    },
    // Custom build plugin for app routing
    {
      name: 'move-app-html',
      closeBundle() {
        const from = path.resolve('dist/app.html');
        const toDir = path.resolve('dist/manage');
        const to = path.join(toDir, 'index.html');

        if (!fs.existsSync(toDir)) fs.mkdirSync(toDir);
        if (fs.existsSync(from)) fs.renameSync(from, to);
      },
    },
    react(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/components': path.resolve(__dirname, './src/components'),
      '@/services': path.resolve(__dirname, './src/services'),
      '@/hooks': path.resolve(__dirname, './src/hooks'),
      '@/pages': path.resolve(__dirname, './src/pages'),
      '@/config': path.resolve(__dirname, './src/config'),
      '@/types': path.resolve(__dirname, './src/types'),
      '@/utils': path.resolve(__dirname, './src/utils'),
    },
  },
  build: {
    rollupOptions: {
      input: {
        app: path.resolve(__dirname, 'app.html'),
      },
    },
  },
  server: {
    port: 3000,
    open: false,
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'yjs'],
  },
});
