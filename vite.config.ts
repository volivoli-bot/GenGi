import { defineConfig, Plugin } from 'vite';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Nombre de caché del service worker automático por build: hash del bundle generado + marca de tiempo del build.
 * Así cada publicación invalida la caché sola (sw.js borra las cachés antiguas al activarse).
 */
function gengiSw(): Plugin {
  let outDir = 'dist';
  let hash = '';
  return {
    name: 'gengi-sw',
    apply: 'build',
    configResolved(c) { outDir = c.build.outDir; },
    generateBundle(_o, bundle) {
      const h = createHash('sha256');
      for (const k of Object.keys(bundle).sort()) {
        const f = bundle[k];
        h.update(k); h.update(f.type === 'chunk' ? f.code : typeof f.source === 'string' ? f.source : Buffer.from(f.source));
      }
      hash = h.digest('hex').slice(0, 10);
    },
    closeBundle() {
      const p = join(outDir, 'sw.js');
      if (!existsSync(p)) return;
      // hash del código + momento del build: cada build tiene un nombre de caché distinto
      const id = `${hash}-${Date.now().toString(36)}`;
      writeFileSync(p, readFileSync(p, 'utf8').replace('__BUILD_ID__', id));
    },
  };
}

export default defineConfig({ base: './', build: { chunkSizeWarningLimit: 1600 }, plugins: [gengiSw()] });
