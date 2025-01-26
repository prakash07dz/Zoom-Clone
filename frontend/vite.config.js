import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'], // Split react and react-dom into a separate chunk
        },
      },
    },
    chunkSizeWarningLimit: 2000, // Set the chunk size limit to 2MB
  },
});
