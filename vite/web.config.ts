/* eslint-disable import/no-extraneous-dependencies */
import react from '@vitejs/plugin-react-swc';
import fs from 'node:fs';
import path from 'node:path';
import { Plugin, defineConfig } from 'vite';

const rootDir = path.resolve(__dirname, '..');
const outDir = path.join(rootDir, 'dist-web');
const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf-8')) as {
    version: string;
};

const webHtmlEntryPlugin = (): Plugin => ({
    name: 'chainner-web-html-entry',
    configureServer: (server) => {
        server.middlewares.use((req, _res, next) => {
            if (req.url === '/' || req.url === '/index.html') {
                req.url = '/web.html';
            }
            next();
        });
    },
    closeBundle: () => {
        const builtWebHtml = path.join(outDir, 'web.html');
        const indexHtml = path.join(outDir, 'index.html');
        if (fs.existsSync(builtWebHtml)) {
            fs.renameSync(builtWebHtml, indexHtml);
        }
    },
});

export default defineConfig({
    root: rootDir,
    base: './',
    define: {
        CHAINNER_APP_VERSION: JSON.stringify(pkg.version),
        CHAINNER_BACKEND_URL: JSON.stringify(process.env.VITE_BACKEND_URL ?? '/api'),
    },
    build: {
        outDir,
        emptyOutDir: true,
        rollupOptions: {
            input: path.join(rootDir, 'web.html'),
        },
    },
    plugins: [webHtmlEntryPlugin(), react()],
    resolve: {
        preserveSymlinks: true,
        alias: {
            path: '@chainner/node-path',
            'electron-log/renderer': path.join(rootDir, 'src/web/electronLogShim.ts'),
        },
    },
    server: {
        host: '127.0.0.1',
        port: 5173,
        proxy: {
            '/api': {
                target: process.env.VITE_BACKEND_PROXY_TARGET || 'http://127.0.0.1:8000',
                changeOrigin: true,
                rewrite: (reqPath) => reqPath.replace(/^\/api/, ''),
            },
        },
    },
});
