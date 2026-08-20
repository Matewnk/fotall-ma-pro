import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: Number(process.env.WEB_PORT) || 5173,
  },
  test: {
    environment: 'jsdom',
    // @testing-library/react ne s'auto-nettoie entre les tests (démontage
    // du DOM) que s'il détecte afterEach sur globalThis.
    globals: true,
  },
});
