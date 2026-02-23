import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import * as path from 'path';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [
    react(),
    tailwindcss({
      content: [
        "./src/**/*.{js,ts,jsx,tsx}"
      ],
      safelist: [
        'w-full',
        'justify-end',
        'bg-brand-primary',
        'text-black',
        'rounded-br-none',
      ],
    }),
  ],
  base: '/client/',
  server: {
    host: '0.0.0.0',
    port: 7002,
    // Disable Vite's CORS handling since Nginx is managing it.
    cors: false,
    proxy: {
      '/api': {
                    target: 'http://localhost:7003',        changeOrigin: true,
      },
    },
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  resolve: {
    
  },
  build: {
    rollupOptions: {
      input: {
        widget: path.resolve(__dirname, 'src/widget.tsx')
      },
      output: {
        entryFileNames: 'widget.js',
        assetFileNames: 'widget.css',
        format: 'es'
      }
    },
    emptyOutDir: true,
  },
  preview: {
    host: true,
    port: 7002,
    cors: false,
    allowedHosts: ['eazee.xyz'],
  },
});
