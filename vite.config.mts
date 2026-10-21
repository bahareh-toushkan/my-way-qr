import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/** 로컬 개발: /api/* 요청을 Vercel과 같은 api/*.ts 함수로 처리 */
function localApi(): Plugin {
  return {
    name: 'local-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? '';
        if (!url.startsWith('/api/')) return next();
        const name = url.slice(5).split('?')[0].replace(/[^a-z-]/g, '');
        try {
          const mod = await server.ssrLoadModule(`/api/${name}.ts`);
          await mod.default(req, res);
        } catch (e) {
          console.error(e);
          res.statusCode = 404;
          res.end(JSON.stringify({ error: `no api ${name}` }));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), localApi()],
  server: { host: true, port: 5173 },
  build: { target: 'es2020', sourcemap: false },
});
