import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

const frontendRoot = path.resolve(__dirname, 'frontend')

function figmaAssetResolver() {
  return {
    name: 'figma-asset-resolver',
    resolveId(id) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '')
        return path.resolve(frontendRoot, 'src/assets', filename)
      }
    },
  }
}

function localEventsApi() {
  return {
    name: 'local-events-api',
    configureServer(server) {
      server.middlewares.use('/api/events', async (request, response, next) => {
        if (request.url?.split('?')[0] !== '/' && request.url?.split('?')[0] !== '') return next();
        const result = {
          setHeader: (name, value) => response.setHeader(name, value),
          status: code => { response.statusCode = code; return result; },
          json: body => { response.setHeader('Content-Type', 'application/json; charset=utf-8'); response.end(JSON.stringify(body)); },
          end: () => response.end(),
        };
        try {
          const { default: handler } = await server.ssrLoadModule(path.resolve(__dirname, 'api/events.mjs'));
          await handler(request, result);
        } catch { response.statusCode = 502; response.end(JSON.stringify({ error: 'Sources momentanément indisponibles' })); }
      });
    },
  }
}

export default defineConfig({
  // The repository root owns tooling; the React application lives in frontend/.
  root: frontendRoot,
  // Keep environment variables at the repository root alongside package.json.
  envDir: __dirname,
  build: {
    rollupOptions: {
      input: Object.fromEntries(['index', 'about', 'privacy', 'terms'].map(page => [page, path.resolve(frontendRoot, `${page}.html`)])),
    },
    // Keep Vercel's standard output location at the repository root.
    outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: true,
  },
  plugins: [
    localEventsApi(),
    figmaAssetResolver(),
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(frontendRoot, './src'),
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],
})
