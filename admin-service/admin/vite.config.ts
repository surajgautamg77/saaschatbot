
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    base: '/admin/',
    publicDir: 'public',

    preview: {
        host: true,
        port: 7001,
        cors: true,
        allowedHosts: ['eazee.xyz'],
        proxy: {
            '/server/api': {
                target: 'http://localhost:7003',
                changeOrigin: true,
            },
            '/server/ws': {
                target: 'http://localhost:7003',
                changeOrigin: true,
                ws: true,
            },
            '/client': {
                target: 'http://localhost:7002',
                changeOrigin: true,
            },
        },
    },

  server: {
        // Also apply the host and port settings here for consistency.
        host: '0.0.0.0',
        port: 7001,
        proxy: {
            '/server/api': {
                target: 'http://localhost:7003',
                changeOrigin: true,
            },
            '/server/ws': {
                target: 'http://localhost:7003',
                changeOrigin: true,
                ws: true,
            },
            '/client': {
                target: 'http://localhost:7002',
                changeOrigin: true,
            },
        },
    },
    resolve: {
        
    },
});
