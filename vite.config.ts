import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
function offline(): Plugin {
  return { name: 'met-offline', enforce: 'post', generateBundle(_, bundle) {
    const assets = Object.keys(bundle).filter(file => !file.endsWith('.map'));
    const version = createHash('sha256').update(JSON.stringify(assets)).digest('hex').slice(0,12);
    this.emitFile({ type: 'asset', fileName: 'precache.json', source: JSON.stringify([...new Set(['./','./index.html','./manifest.webmanifest','./icon.svg','./icon-192.png','./icon-512.png','./apple-touch-icon.png','./treasury-reference.jpeg',...assets.map(file=>`./${file}`)])]) });
    this.emitFile({ type:'asset', fileName:'sw.js', source: readFileSync(new URL('./src/service-worker.js',import.meta.url),'utf8').replace('__BUILD_VERSION__',version) });
  } };
}
export default defineConfig({ root: 'src', publicDir: '../public', base: './', plugins: [react(), offline()], build: { outDir: '../dist', emptyOutDir: true } });
