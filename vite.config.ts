import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [
      // Custom plugin to replace environment variables in HTML files
      {
        name: 'env-replacement',
        transformIndexHtml(html: string) {
          // Replace %ENV_VAR% patterns with actual environment values
          return html.replace(/%(\w+)%/g, (_match, envVar) => {
            return env[envVar] || '';
          });
        },
        configureServer(server) {
          // Also handle env replacement for files in public/ directory during dev
          server.middlewares.use((req, res, next) => {
            if (req.url === '/index.html' || req.url === '/') {
              const filePath = path.resolve('public/index.html');
              let html = fs.readFileSync(filePath, 'utf-8');

              // Replace environment variables
              html = html.replace(/%(\w+)%/g, (_match, envVar) => {
                return env[envVar] || '';
              });

              res.setHeader('Content-Type', 'text/html');
              res.end(html);
              return;
            }
            next();
          });
        },
      },
    // Custom dev routing plugin
    {
      name: 'dev-routing',
      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          if (req.url?.startsWith('/manage') && !req.url.includes('.')) {
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
  };
});
