// Abre un Issue en GitHub con los planes de prensa que la IA no ha podido verificar con confianza.
// Solo avisa de los nuevos (data/cache/review-reported.json recuerda los ya avisados).
// Requiere el CLI `gh` y GH_TOKEN (en Actions ya vienen). Fuera de Actions, solo imprime el resumen.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { ROOT } from './lib/util.mjs';

const read = (rel, fallback) => (existsSync(path.join(ROOT, rel)) ? JSON.parse(readFileSync(path.join(ROOT, rel), 'utf8')) : fallback);
const review = read('data/review.json', []);
const reportedFile = 'data/cache/review-reported.json';
const reported = new Set(read(reportedFile, []));
const fresh = review.filter((r) => !reported.has(r.id));

if (!fresh.length) { console.log('Revisión: nada nuevo que avisar.'); process.exit(0); }

const rows = fresh.map((r) => `| \`${r.id}\` | ${r.titulo.replace(/\|/g, '/')} | ${r.inicio} | ${[r.municipio, r.provincia].filter(Boolean).join(', ') || '—'} | ${Math.round(r.confianza * 100)} % | [${r.fuente}](${r.url}) |`);
const body = `La IA ha extraído estos planes de prensa pero no está segura. **No se publican** hasta que decidas.

| id | Plan | Fecha | Lugar | Confianza | Fuente |
|---|---|---|---|---|---|
${rows.join('\n')}

**Cómo decidir:** edita \`config/revision.json\` y copia el id en \`aprobados\` (se publica) o en \`rechazados\` (se descarta para siempre). Al hacer commit, el workflow se relanza solo.

Si no haces nada, no pasa nada: simplemente no se publican.`;

if (!process.env.GH_TOKEN && !process.env.GITHUB_TOKEN) {
  console.log(`Revisión (sin GH_TOKEN, no se abre Issue): ${fresh.length} planes nuevos.\n${body}`);
  process.exit(0);
}

const title = `Revisar ${fresh.length} plan${fresh.length === 1 ? '' : 'es'} de prensa (${new Date().toISOString().slice(0, 10)})`;
try { execFileSync('gh', ['label', 'create', 'revisar', '--color', 'F2B705', '--description', 'Planes de prensa pendientes de revisión', '--force'], { stdio: 'ignore' }); } catch { /* sin etiqueta, el issue se abre igual */ }
execFileSync('gh', ['issue', 'create', '--title', title, '--body', body, '--label', 'revisar'], { stdio: 'inherit' });
mkdirSync(path.join(ROOT, 'data/cache'), { recursive: true });
writeFileSync(path.join(ROOT, reportedFile), JSON.stringify([...reported, ...fresh.map((r) => r.id)], null, 1));
