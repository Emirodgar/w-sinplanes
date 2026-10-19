// Pipeline diario de sinplanes.com
// 1) calendario estacional  2) fuentes externas  3) normalizar y deduplicar
// 4) prensa → planes con IA  5) enriquecer y traducir con IA (opcional)  6) tendencias  7) escribir data/*.json
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { load as yamlLoad } from 'js-yaml';
import { ROOT, slugify, hash, truncate, todayISO, addDays, resolveProvince, guessTopics, guessIndoor } from './lib/util.mjs';
import { buildSeasonalPlans } from './lib/seasonal.mjs';
import { enrich, aiStats } from './lib/ai.mjs';
import { translatePlans } from './lib/translate.mjs';
import { extractPress } from './lib/extract.mjs';
import { fetchTrends, mergeHistory, applyTrends, saveTrends, readHistory } from './lib/trends.mjs';

const TODAY = process.env.SINPLANES_TODAY || todayISO();
const KEEP_PAST_DAYS = 30;   // las páginas de eventos pasados se mantienen 30 días (noindex)
const HORIZON_DAYS = 120;    // no publicamos eventos a más de 4 meses vista

const log = (...a) => console.log('[sinplanes]', ...a);

async function runSources() {
  // Modo sin red para desarrollo local: SINPLANES_OFFLINE=1 npm run pipeline
  if (process.env.SINPLANES_OFFLINE) {
    const items = JSON.parse(readFileSync(path.join(ROOT, 'scripts/fixtures/sample-events.json'), 'utf8'));
    const src = { id: 'fixtures', nombre: 'Datos de ejemplo' };
    return { raw: items.map((it) => ({ ...it, _src: src })), candidates: [], report: [{ id: 'fixtures', status: 'ok', count: items.length }] };
  }
  const { fuentes } = yamlLoad(readFileSync(path.join(ROOT, 'config/sources.yml'), 'utf8'));
  const report = [];
  const raw = [];
  const candidates = [];
  for (const src of fuentes) {
    if (!src.activa) continue;
    if (src.secreto && !process.env[src.secreto]) {
      report.push({ id: src.id, status: 'omitida', detail: `falta el secreto ${src.secreto}` });
      continue;
    }
    try {
      const { default: adapter } = await import(`./adapters/${src.adaptador}.mjs`);
      const items = await adapter(src);
      // Los adaptadores de prensa devuelven candidatos, no eventos: los procesa la extracción por IA
      items.forEach((it) => (it._candidate ? candidates : raw).push({ ...it, _src: src }));
      report.push({ id: src.id, status: 'ok', count: items.length, ...(src.adaptador === 'rss' ? { candidatos: true } : {}) });
      log(`${src.id}: ${items.length} elementos`);
    } catch (err) {
      // Una fuente caída nunca rompe la publicación
      report.push({ id: src.id, status: 'error', detail: err.message });
      log(`${src.id}: ERROR ${err.message}`);
    }
  }
  return { raw, candidates, report };
}

function normalize(it) {
  if (!it.title || !it.start) return null;
  const end = it.end && it.end >= it.start ? it.end : it.start;
  if (end < addDays(TODAY, -KEEP_PAST_DAYS) || it.start > addDays(TODAY, HORIZON_DAYS)) return null;

  const prov = resolveProvince(it.provincia);
  const rawText = `${it.description || ''} ${it.venue || ''}`.trim();
  const blob = `${it.title} ${rawText}`;
  const id = hash(`${it._src.id}|${it.title}|${it.start}|${it.municipio || ''}`);
  const summary = truncate(it.description || '', 240);

  return {
    id,
    slug: `${slugify(it.title)}-${id.slice(0, 5)}`,
    kind: it.kind || 'evento',
    title: { es: it.title.trim(), ...(it.title_en ? { en: it.title_en.trim() } : {}) },
    summary: { es: summary, ...(it.summary_en ? { en: truncate(it.summary_en, 240) } : {}) },
    rawText, lang: it.lang || 'es',
    start: it.start, end, time: it.time || null,
    topics: it.topics || guessTopics(blob, it.hints || []),
    indoor: it.indoor ?? guessIndoor(blob),
    free: !!it.free, price: it.price || null,
    place: it.scope === 'nacional'
      ? { scope: 'nacional' }
      : { scope: 'local', municipio: it.municipio || null, provincia: prov?.provincia || it.provincia || null, ccaa: prov?.ccaa || null, venue: it.venue || null, lat: it.lat || null, lon: it.lon || null },
    source: { name: it._src.nombre, url: it.url || null, license: it._src.licencia || null },
    ...(it.ai ? { ai: true } : {}),
  };
}

function dedupe(plans) {
  const seen = new Map();
  for (const p of plans) {
    const key = `${slugify(p.title.es)}|${p.start}|${slugify(p.place.municipio || '')}`;
    if (!seen.has(key)) seen.set(key, p);
  }
  return [...seen.values()];
}

async function trendsStep(plans) {
  let history = readHistory();
  if (!process.env.SINPLANES_OFFLINE) {
    try { history = mergeHistory(history, TODAY, await fetchTrends()); log(`Tendencias: ${history.length} términos en la ventana.`); }
    catch (err) { log(`Tendencias: no disponibles (${err.message}). Se usa el historial guardado.`); }
  }
  saveTrends(history, TODAY);
  return applyTrends(plans, history, TODAY);
}

async function main() {
  log(`Ejecutando para ${TODAY}`);
  const seasonal = buildSeasonalPlans(TODAY);
  const { raw, candidates, report } = await runSources();
  const press = await extractPress(candidates, TODAY, log);
  raw.push(...press.events);
  let external = dedupe(raw.map(normalize).filter(Boolean));
  external = await enrich(external, log);
  external = external.map(({ rawText, lang, ...rest }) => rest); // no publicamos el texto original completo

  let plans = [...seasonal, ...external].sort((a, b) => (a.start || '9999').localeCompare(b.start || '9999'));
  plans = await translatePlans(plans, TODAY, log);
  plans = await trendsStep(plans);

  mkdirSync(path.join(ROOT, 'data'), { recursive: true });
  writeFileSync(path.join(ROOT, 'data/plans.json'), JSON.stringify(plans, null, 1));
  writeFileSync(path.join(ROOT, 'data/meta.json'), JSON.stringify({
    generated: new Date().toISOString(), today: TODAY, total: plans.length, seasonal: seasonal.length, external: external.length,
    review: press.review.length, trending: plans.filter((p) => p.trend).length, sources: report,
  }, null, 2));
  const st = aiStats();
  log(`IA: ${st.calls} peticiones en ${st.seconds} s${st.tripped ? ' (cortada por límite de uso)' : ''}.`);
  log(`Listo: ${plans.length} planes (${seasonal.length} de calendario, ${external.length} de fuentes, ${press.review.length} en revisión).`);
}

main().catch((e) => { console.error(e); process.exit(1); });
