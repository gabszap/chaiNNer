/* eslint-disable import/no-extraneous-dependencies */
import react from '@vitejs/plugin-react-swc';
import fs from 'node:fs';
import path from 'node:path';
import { Plugin, ProxyOptions, defineConfig } from 'vite';

const rootDir = path.resolve(__dirname, '..');
const outDir = path.join(rootDir, 'dist-web');
const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf-8')) as {
    version: string;
};

const apiProxy: Record<string, ProxyOptions> = {
    '/api': {
        target: process.env.VITE_BACKEND_PROXY_TARGET || 'http://127.0.0.1:8000',
        changeOrigin: true,
        rewrite: (reqPath) => reqPath.replace(/^\/api/, ''),
    },
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

const getManualChunk = (id: string): string | undefined => {
    if (!id.includes('node_modules')) return undefined;
    if (id.includes('react-icons')) return 'vendor-icons';
    if (id.includes('@chakra-ui') || id.includes('@emotion') || id.includes('framer-motion')) {
        return 'vendor-chakra';
    }
    if (id.includes('reactflow') || id.includes('d3-')) return 'vendor-reactflow';
    if (id.includes('@chainner/navi') || id.includes('rregex')) return 'vendor-navi';
    if (
        id.includes('/react/') ||
        id.includes('\\react\\') ||
        id.includes('react-dom') ||
        id.includes('scheduler')
    ) {
        return 'vendor-react';
    }
    return undefined;
};

export default defineConfig({
    root: rootDir,
    base: './',
    define: {
        CHAINNER_APP_VERSION: JSON.stringify(pkg.version),
        CHAINNER_BACKEND_URL: JSON.stringify(process.env.VITE_BACKEND_URL ?? '/api'),
    },
    optimizeDeps: {
        entries: ['web.html'],
        include: [
            'react',
            'react-dom',
            'react-dom/client',
            '@chakra-ui/react',
            '@chakra-ui/icons',
            '@emotion/react',
            '@emotion/styled',
            'framer-motion',
            'reactflow',
            'react-query',
            'axios',
            'i18next',
            'react-i18next',
            'use-context-selector',
            '@chainner/navi',
            'fast-deep-equal',
            'semver',
            'react-icons/md',
            'react-icons/bs',
            'react-icons/fa',
            'react-icons/io5',
            'react-icons/hi2',
        ],
    },
    build: {
        outDir,
        emptyOutDir: true,
        rollupOptions: {
            input: path.join(rootDir, 'web.html'),
            output: {
                manualChunks: getManualChunk,
            },
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
        watch: {
            ignored: [
                '**/.venv/**',
                '**/venv/**',
                '**/backend/**',
                '**/dist-web/**',
                '**/.vite/**',
                '**/out/**',
                '**/tests/**',
                '**/docs/**',
                '**/*.log',
                '**/log.txt',
            ],
        },
        proxy: apiProxy,
    },
    preview: {
        host: '127.0.0.1',
        port: 4173,
        proxy: apiProxy,
    },
});
