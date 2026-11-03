import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Pri vývoji administrácie: spusti aj server s DATA_DIR (npm run admin:dev) na porte 8080
    proxy: {
      '/api/admin': 'http://localhost:8080',
      '/api/public': 'http://localhost:8080',
    },
  },
});
