import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig, Plugin} from 'vite';

function localGarminFitPlugin(): Plugin {
  return {
    name: 'local-garmin-fit',
    configureServer(server) {
      server.middlewares.use('/api/garmin/local-fit', (req, res) => {
        const rawUrl = req.url || '';
        const activityId = rawUrl.replace(/^\//, '').split('?')[0];
        if (!activityId) {
          res.statusCode = 400;
          res.end('Missing activityId');
          return;
        }
        const assetsDir = path.resolve(__dirname, 'public/assets/aistudio');
        try {
          if (fs.existsSync(assetsDir)) {
            const files = fs.readdirSync(assetsDir);
            const match = files.find(f => f.includes(activityId));
            if (match) {
              const filePath = path.join(assetsDir, match);
              const data = fs.readFileSync(filePath);
              res.setHeader('Content-Type', 'application/octet-stream');
              res.setHeader('Content-Disposition', `attachment; filename="${match}"`);
              res.end(data);
              return;
            }
          }
        } catch (e) {
          console.warn('Error reading local fit asset:', e);
        }
        res.statusCode = 404;
        res.end('Not found');
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), localGarminFitPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      proxy: {
        '/api/garmin': {
          target: 'https://personal.connectapi.garmin.com',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api\/garmin/, ''),
          secure: true,
        },
      },
    },
  };
});

