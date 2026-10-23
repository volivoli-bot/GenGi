import { defineConfig, Plugin } from 'vite';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/** Todos los ficheros bajo dir (rutas relativas a root con /). */
function walk(dir: string, root: string, out: string[] = []): string[] {
  for (const n of readdirSync(dir).sort()) {
    const f = join(dir, n);
    if (statSync(f).isDirectory()) walk(f, root, out);
    else out.push(relative(root, f).split(sep).join('/'));
  }
  return out;
}

/**
 * Nombre de caché del service worker automático por build: hash del bundle generado + marca de tiempo del build.
 * Así cada publicación invalida la caché sola (sw.js borra las cachés antiguas al activarse).
 * v3.2: la lista de precarga también se genera: todo lo que hay en dist (public/art, iconos, manifiesto, bundle)
 * salvo sw.js y los .map, para que ningún arte nuevo se quede fuera del modo sin conexión.
 */
function gengiSw(): Plugin {
  let outDir = 'dist';
  let hash = '';
  return {
    name: 'gengi-sw',
    apply: 'build',
    configResolved(c) { outDir = join(c.root, c.build.outDir); },
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
      const files = walk(outDir, outDir).filter(f => f !== 'sw.js' && !f.endsWith('.map'));
      const list = ['./', ...files.map(f => './' + f)];
      writeFileSync(p, readFileSync(p, 'utf8').replace('__BUILD_ID__', id).replace('__PRECACHE__', JSON.stringify(list)));
    },
  };
}

export default defineConfig({ base: './', build: { chunkSizeWarningLimit: 1600 }, plugins: [gengiSw()] });
