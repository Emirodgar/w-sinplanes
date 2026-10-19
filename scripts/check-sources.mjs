// Comprueba que cada fuente responde y devuelve elementos. Escribe un informe
// en el resumen del job de GitHub Actions si está disponible.
import { readFileSync, appendFileSync } from 'node:fs';
import path from 'node:path';
import { load as yamlLoad } from 'js-yaml';
import { ROOT } from './lib/util.mjs';

const { fuentes } = yamlLoad(readFileSync(path.join(ROOT, 'config/sources.yml'), 'utf8'));
const rows = [];
for (const src of fuentes) {
  if (src.secreto && !process.env[src.secreto]) { rows.push([src.id, '⏭️ omitida', `sin ${src.secreto}`]); continue; }
  try {
    const { default: adapter } = await import(`./adapters/${src.adaptador}.mjs`);
    const items = await adapter(src);
    const sample = items.find((i) => i.title && (i.start || i.published));
    rows.push([src.id, items.length ? '✅ ok' : '⚠️ vacía', `${items.length} elementos${sample ? ` · ej.: ${sample.title.slice(0, 50)} (${sample.start || sample.published})` : ''}`]);
  } catch (e) {
    rows.push([src.id, '❌ error', e.message.slice(0, 120)]);
  }
}
const md = ['| Fuente | Estado | Detalle |', '|---|---|---|', ...rows.map((r) => `| ${r.join(' | ')} |`)].join('\n');
console.log(md);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Estado de las fuentes\n\n${md}\n`);
if (rows.some((r) => r[1].startsWith('❌'))) process.exitCode = 1;
