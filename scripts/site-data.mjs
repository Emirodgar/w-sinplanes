// Compone los datos del sitio justo antes del build (npm run build / dev). SIN red y SIN IA.
//
//   esqueleto fijo   = config/seasonal.yml (planes estacionales + citas anuales con fechas calculadas) + traducciones cacheadas
//   datos variables  = data/events.json (lo que escriben los crons; puede faltar o estar viejo)
//   señal            = data/trends.json
//
// Salida (no se versiona): data/plans.json y data/site.json. Si los crons llevan semanas sin funcionar,
// el sitio sigue completo: los eventos pasados caducan solos y el calendario estacional sigue vigente.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { ROOT, todayISO, addDays } from './lib/util.mjs';
import { buildSeasonalPlans } from './lib/seasonal.mjs';
import { applyCachedTranslations } from './lib/translate.mjs';
import { applyTrends, readHistory } from './lib/trends.mjs';
import { buildBooks } from './lib/libros.mjs';

const KEEP_PAST_DAYS = 30; // eventos pasados: su página se mantiene 30 días con noindex
const HORIZON_DAYS = 120;

const today = process.env.SINPLANES_TODAY || todayISO();
const readJSON = (rel, fallback) => (existsSync(path.join(ROOT, rel)) ? JSON.parse(readFileSync(path.join(ROOT, rel), 'utf8')) : fallback);

const skeleton = applyCachedTranslations(buildSeasonalPlans(today));
const events = readJSON('data/events.json', []).filter((p) => (p.end || p.start) >= addDays(today, -KEEP_PAST_DAYS) && p.start <= addDays(today, HORIZON_DAYS));
const meta = readJSON('data/meta.json', {});

const plans = applyTrends([...skeleton, ...events], readHistory(), today)
  .sort((a, b) => (a.start || '9999').localeCompare(b.start || '9999'));

mkdirSync(path.join(ROOT, 'data'), { recursive: true });
writeFileSync(path.join(ROOT, 'data/plans.json'), JSON.stringify(plans));
// Cartelera: solo si es reciente (los crons la renuevan a diario); una cartelera vieja es peor que ninguna.
const cartelera = readJSON('data/cartelera.json', { peliculas: [] });
const fresh = cartelera.generated && (Date.parse(today) - Date.parse(cartelera.generated.slice(0, 10))) / 864e5 <= 21;
writeFileSync(path.join(ROOT, 'data/cine.json'), JSON.stringify({ peliculas: fresh ? cartelera.peliculas : [] }));
// Series: mismo criterio de frescura que la cartelera.
const seriesRaw = readJSON('data/series-tmdb.json', {});
const seriesFresh = seriesRaw.generated && (Date.parse(today) - Date.parse(seriesRaw.generated.slice(0, 10))) / 864e5 <= 21;
writeFileSync(path.join(ROOT, 'data/series.json'), JSON.stringify({
  mejores: seriesFresh ? (seriesRaw.mejores || seriesRaw.series || []) : [],
  novedades: seriesFresh ? (seriesRaw.novedades || []) : [],
}));
writeFileSync(path.join(ROOT, 'data/libros.json'), JSON.stringify(buildBooks(today)));
writeFileSync(path.join(ROOT, 'data/site.json'), JSON.stringify({
  today, generated: new Date().toISOString(), total: plans.length, skeleton: skeleton.length, events: events.length,
  dataUpdated: meta.generated || null,
}, null, 2));
console.log(`[site-data] ${today}: ${skeleton.length} planes de esqueleto + ${events.length} eventos${meta.generated ? ` (datos de ${meta.generated.slice(0, 10)})` : ' (sin datos de crons todavía)'}.`);
