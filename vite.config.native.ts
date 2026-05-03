import { defineConfig, type Plugin } from 'vite';
import preact from '@preact/preset-vite';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import fs from 'fs';

// Dev: rewrite the HTML entry to load main-native.tsx instead of main.tsx
// Build: uses index-native.html directly via rollupOptions.input
function nativeEntryPlugin(): Plugin {
  return {
    name: 'native-entry',
    transformIndexHtml(html) {
      return html
        .replace('/src/main.tsx', '/src/main-native.tsx')
        .replace(
          "connect-src 'self'",
          "connect-src 'self' https://*.supabase.co",
        );
    },
    closeBundle() {
      // Capacitor expects dist/index.html — rename after build
      const dir = path.resolve(__dirname, 'dist');
      const src = path.join(dir, 'index-native.html');
      const dest = path.join(dir, 'index.html');
      if (fs.existsSync(src)) {
        if (fs.existsSync(dest)) fs.unlinkSync(dest);
        fs.renameSync(src, dest);
      }
    },
  };
}

export default defineConfig({
  base: '/',
  server: {
    port: 1337,
  },
  plugins: [
    nativeEntryPlugin(),
    preact(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      react: 'preact/compat',
      'react-dom': 'preact/compat',
      // Swap IDB storage for Supabase in native builds
      [path.resolve(__dirname, 'src/db.ts')]: path.resolve(__dirname, 'src/db-supabase.ts'),
    },
  },
  build: {
    rollupOptions: {
      input: {
        'index-native': path.resolve(__dirname, 'index-native.html'),
      },
    },
    outDir: 'dist',
  },
});
