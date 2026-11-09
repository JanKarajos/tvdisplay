import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Staršie prehliadače (Android WebView, smart TV) – novšia syntax sa prepíše
  build: { target: ['chrome80', 'safari13', 'firefox78'] },
  server: {
    host: '0.0.0.0', // Umožní prístup z iných zariadení v sieti
    port: 5173,
    // Administrácia používa prihlásenie cez cookie, preto pri vývoji ide cez rovnakú adresu ako aplikácia
    proxy: {
      '/api/admin': 'http://localhost:3002',
      '/api/public': 'http://localhost:3002',
    },
  },
});
