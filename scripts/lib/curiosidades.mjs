import { readFileSync } from 'node:fs';
import path from 'node:path';
import { load as yamlLoad } from 'js-yaml';
import { ROOT } from './util.mjs';

const dayNum = (iso) => Math.floor(Date.parse(iso.slice(0, 10)) / 864e5);
const hash = (s) => [...s].reduce((a, c) => (Math.imul(a, 31) + c.charCodeAt(0)) >>> 0, 7);

/**
 * Curiosidades del sitio y la del día. Una al día, recorriendo la lista en ciclos barajados (el orden de cada ciclo sale de una
 * semilla estable) sin repetir hasta agotarla; todos los visitantes ven la misma ese día.
 */
export function buildCuriosidades(today, cfgPath = path.join(ROOT, 'config/curiosidades.yml')) {
  const todas = (yamlLoad(readFileSync(cfgPath, 'utf8')) || {}).curiosidades || [];
  const ids = new Set();
  for (const c of todas) {
    if (!c.id || ids.has(c.id)) throw new Error(`curiosidades.yml: id vacío o repetido (${c.id})`);
    ids.add(c.id);
  }
  let hoy = null;
  if (todas.length) {
    const n = todas.length;
    const d = dayNum(today);
    const order = todas.map((c, i) => ({ i, k: hash(`${Math.floor(d / n)}:${c.id}`) })).sort((a, b) => a.k - b.k || a.i - b.i);
    hoy = todas[order[d % n].i].id;
  }
  return { todas, hoy };
}
