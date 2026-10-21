// Pipeline de datos de sinplanes.com (lo ejecutan los crons; el build del sitio NO lo ejecuta).
// 1) fuentes externas  2) normalizar y deduplicar  3) prensa → planes con IA
// 4) enriquecer y traducir con IA (opcional)  5) historial de tendencias
// Salida: data/events.json (solo eventos externos), data/trends.json, data/review.json, data/meta.json.
// El esqueleto fijo (planes estacionales y citas anuales) NO se escribe aquí: lo compone scripts/site-data.mjs
// desde config/ en cada build, así que existe aunque este pipeline falle.
//   SINPLANES_NO_AI=1  →  no llama a la IA, solo reaplica lo ya cacheado (cron de agendas)
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { load as yamlLoad } from 'js-yaml';
import { ROOT, slugify, hash, truncate, tidyTitle, cleanDescription, todayISO, addDays, resolveProvince, guessTopics, guessIndoor } from './lib/util.mjs';
import { buildSeasonalPlans } from './lib/seasonal.mjs';
import { enrich, aiStats } from './lib/ai.mjs';
import { translatePlans } from './lib/translate.mjs';
import { extractPress } from './lib/extract.mjs';
import { fetchCartelera } from './lib/cartelera.mjs';
import { fetchSeries } from './lib/series.mjs';
import { fetchTrends, mergeHistory, saveTrends, readHistory } from './lib/trends.mjs';

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
      report.push({ id: src.id, nombre: src.nombre, status: 'error', detail: err.message });
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
  const title = tidyTitle(it.title);
  const desc = cleanDescription(it.description || '');
  // Sin descripción en origen, un dato verificable en vez de un hueco: dónde es.
  const summary = desc ? truncate(desc, 240) : (it.venue ? `En ${it.venue}${it.municipio && !it.venue.includes(it.municipio) ? ` (${it.municipio})` : ''}.` : '');

  return {
    id,
    slug: `${slugify(title)}-${id.slice(0, 5)}`,
    kind: it.kind || 'evento',
    title: { es: title, ...(it.title_en ? { en: it.title_en.trim() } : {}) },
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

async function trendsStep() {
  let history = readHistory();
  if (!process.env.SINPLANES_OFFLINE) {
    try { history = mergeHistory(history, TODAY, await fetchTrends()); log(`Tendencias: ${history.length} términos en la ventana.`); }
    catch (err) { log(`Tendencias: no disponibles (${err.message}). Se usa el historial guardado.`); }
  }
  saveTrends(history, TODAY);
}

// Cartelera de cine (TMDB, sin IA). Si falla, se conserva la última guardada.
async function carteleraStep() {
  mkdirSync(path.join(ROOT, 'data'), { recursive: true });
  const file = path.join(ROOT, 'data/cartelera.json');
  if (process.env.SINPLANES_OFFLINE) return;
  if (!process.env.TMDB_API_KEY) { log('Cartelera: falta TMDB_API_KEY, se omite.'); return; }
  try {
    const cartelera = await fetchCartelera(process.env.TMDB_API_KEY);
    writeFileSync(file, JSON.stringify(cartelera));
    log(`Cartelera: ${cartelera.peliculas.length} películas.`);
  } catch (err) { log(`Cartelera: no disponible (${err.message}). Se conserva la anterior.`); }
}

// Series actuales y bien valoradas (TMDB, sin IA). Si falla, se conserva la última guardada.
async function seriesStep() {
  mkdirSync(path.join(ROOT, 'data'), { recursive: true });
  if (process.env.SINPLANES_OFFLINE) return;
  if (!process.env.TMDB_API_KEY) { log('Series: falta TMDB_API_KEY, se omite.'); return; }
  try {
    const series = await fetchSeries(process.env.TMDB_API_KEY, TODAY);
    writeFileSync(path.join(ROOT, 'data/series-tmdb.json'), JSON.stringify(series));
    log(`Series: ${series.mejores.length} mejores y ${series.novedades.length} novedades y ${series.estrenos.length} estrenos.`);
  } catch (err) { log(`Series: no disponibles (${err.message}). Se conservan las anteriores.`); }
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
  // Una fuente caída no debe vaciar sus planes: se conservan los últimos que publicó (hasta que caduquen por fecha).
  const failed = new Set(report.filter((r) => r.status === 'error').map((r) => r.nombre));
  if (failed.size && existsSync(path.join(ROOT, 'data/events.json'))) {
    const kept = JSON.parse(readFileSync(path.join(ROOT, 'data/events.json'), 'utf8')).filter((p) => failed.has(p.source?.name));
    if (kept.length) { external.push(...kept); log(`Fuentes caídas (${[...failed].join(', ')}): se conservan ${kept.length} planes anteriores.`); }
  }

  // Se traduce el calendario propio junto con los eventos para rellenar la caché; el calendario no se guarda aquí.
  const translated = await translatePlans([...seasonal, ...external], TODAY, log);
  const events = translated.filter((p) => p.source?.name !== 'sinplanes').sort((a, b) => (a.start || '9999').localeCompare(b.start || '9999'));
  await trendsStep();
  await carteleraStep();
  await seriesStep();

  mkdirSync(path.join(ROOT, 'data'), { recursive: true });
  writeFileSync(path.join(ROOT, 'data/events.json'), JSON.stringify(events));
  writeFileSync(path.join(ROOT, 'data/meta.json'), JSON.stringify({
    generated: new Date().toISOString(), today: TODAY, events: events.length, review: press.review.length,
    ai: aiStats(), sources: report,
  }, null, 2));
  log(`Listo: ${events.length} eventos de fuentes, ${press.review.length} en revisión. IA: ${aiStats().calls} peticiones.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
