import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
        'real-firebase/app': path.resolve(__dirname, 'node_modules/firebase/app/dist/esm/index.esm.js'),
        'real-firebase/auth': path.resolve(__dirname, 'node_modules/firebase/auth/dist/esm/index.esm.js'),
        'firebase/firestore': path.resolve(__dirname, 'src/lib/supabaseDb.ts'),
        'firebase/auth': path.resolve(__dirname, 'src/lib/supabaseAuth.ts'),
        'firebase/app': path.resolve(__dirname, 'src/lib/supabaseApp.ts'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
