import { getJSON, addDays } from './util.mjs';

// Series de TMDB (clave gratuita en TMDB_API_KEY). No usa IA. Tres listas, todas con disponibilidad en España:
//   mejores   = nota >= 7,5 con >= 500 votos y episodios emitidos en los últimos 12 meses (por popularidad)
//   novedades = estrenadas en los últimos 90 días con nota >= 7,0 y >= 100 votos (una serie recién salida aún no suma 500 votos)
//   estrenos  = las más populares estrenadas en las últimas 3 semanas, de la más reciente a la más antigua, SIN exigir nota
const API = 'https://api.themoviedb.org/3';
const LOCALES = { es: 'es-ES', en: 'en-US', fr: 'fr-FR', de: 'de-DE', it: 'it-IT', pt: 'pt-PT' };
const EXCLUDED_GENRES = '10763,10767,10764'; // noticias, tertulias y reality: no son "series" en el sentido que busca el lector
const KIDS_GENRES = new Set([16, 10762, 10751]); // animación, infantil, familia
const KIDS_CERT = new Set(['TP', '7', 'A', 'TV-Y', 'TV-Y7', 'TV-G']);
const ADULT_CERT = new Set(['16', '18', 'TV-14', 'TV-MA']);
const MAX_PLATFORMS = 3;
const MAX_OVERVIEW = 320;
const MIN_VOTES_SHOWN = 10;

const LISTS = {
  mejores: (today) => ({ 'vote_average.gte': '7.5', 'vote_count.gte': '500', 'air_date.gte': addDays(today, -365), 'air_date.lte': today, sort_by: 'popularity.desc' }),
  novedades: (today) => ({ 'vote_average.gte': '7.0', 'vote_count.gte': '100', 'first_air_date.gte': addDays(today, -90), 'first_air_date.lte': today, sort_by: 'first_air_date.desc' }),
  estrenos: (today) => ({ 'first_air_date.gte': addDays(today, -21), 'first_air_date.lte': today, sort_by: 'popularity.desc' }),
};

/** A quién va dirigida: la calificación por edades manda; si no hay o es intermedia, decide el género. */
export function seriesAudience(cert, genreIds) {
  if (KIDS_CERT.has(cert)) return 'ninos';
  if (ADULT_CERT.has(cert)) return 'adultos';
  return genreIds.some((g) => KIDS_GENRES.has(g)) ? 'ninos' : 'adultos';
}

const discover = async (key, locale, today, kind, pages = 2) => {
  const params = new URLSearchParams({
    language: locale, watch_region: 'ES', with_watch_monetization_types: 'flatrate|free|ads',
    without_genres: EXCLUDED_GENRES, api_key: key, ...LISTS[kind](today),
  });
  const out = [];
  for (let page = 1; page <= pages; page++) {
    const data = await getJSON(`${API}/discover/tv?${params}&page=${page}`);
    out.push(...(data.results || []));
  }
  return out;
};

async function spanishRating(key, id) {
  try {
    const data = await getJSON(`${API}/tv/${id}/content_ratings?api_key=${key}`);
    const find = (c) => (data.results || []).find((r) => r.iso_3166_1 === c)?.rating || null;
    return find('ES') || find('US');
  } catch {
    return null; // sin calificación: se decide por género
  }
}

async function platforms(key, id) {
  try {
    const data = await getJSON(`${API}/tv/${id}/watch/providers?api_key=${key}`);
    const es = data.results?.ES || {};
    const list = [...(es.flatrate || []), ...(es.free || []), ...(es.ads || [])];
    return [...new Set(list.map((p) => p.provider_name))].slice(0, MAX_PLATFORMS);
  } catch {
    return [];
  }
}

const clip = (s) => (s && s.length > MAX_OVERVIEW ? `${s.slice(0, MAX_OVERVIEW).replace(/\s+\S*$/, '')}…` : s || '');

async function fetchList(key, today, kind, max, extras) {
  let es = (await discover(key, LOCALES.es, today, kind))
    .filter((s) => s.poster_path && !s.adult && (kind !== 'estrenos' || s.overview)) // sin sinopsis suele ser ruido
    .slice(0, kind === 'estrenos' ? 36 : max);
  if (kind === 'estrenos') es = es.sort((a, b) => (b.first_air_date || '').localeCompare(a.first_air_date || '')).slice(0, max);
  const names = { es: Object.fromEntries(es.map((s) => [s.id, s])) };
  for (const [lang, locale] of Object.entries(LOCALES)) {
    if (lang === 'es') continue;
    try { names[lang] = Object.fromEntries((await discover(key, locale, today, kind)).map((s) => [s.id, s])); }
    catch { names[lang] = {}; }
  }

  const items = [];
  for (const s of es) {
    if (!extras.has(s.id)) {
      const [cert, where] = await Promise.all([spanishRating(key, s.id), platforms(key, s.id)]);
      extras.set(s.id, { cert, where });
    }
    const { cert, where } = extras.get(s.id);
    items.push({
      id: s.id,
      titulo: Object.fromEntries(Object.keys(LOCALES).map((l) => [l, names[l]?.[s.id]?.name || s.name])),
      sinopsis: Object.fromEntries(Object.keys(LOCALES).map((l) => [l, clip(names[l]?.[s.id]?.overview)]).filter(([, v]) => v)),
      poster: s.poster_path,
      nota: s.vote_count >= MIN_VOTES_SHOWN ? Math.round(s.vote_average * 10) / 10 : null, // con pocos votos la nota no significa nada
      anio: s.first_air_date ? Number(s.first_air_date.slice(0, 4)) : null,
      estreno: s.first_air_date || null,
      plataformas: where,
      publico: seriesAudience(cert, s.genre_ids || []),
    });
  }
  return items;
}

export async function fetchSeries(key, today, { max = 36, maxNovedades = 24, maxEstrenos = 18 } = {}) {
  const extras = new Map(); // calificación y plataformas se piden una sola vez por serie
  const mejores = await fetchList(key, today, 'mejores', max, extras);
  if (!mejores.length) throw new Error('TMDB no devolvió series que cumplan el criterio');
  let novedades = [];
  try { novedades = await fetchList(key, today, 'novedades', maxNovedades, extras); }
  catch { /* las novedades son opcionales: la lista de mejores se publica igualmente */ }
  let estrenos = [];
  try { estrenos = await fetchList(key, today, 'estrenos', maxEstrenos, extras); }
  catch { /* opcional, como las novedades */ }
  const recent = new Set(estrenos.map((s) => s.id));
  novedades = novedades.filter((s) => !recent.has(s.id)); // una serie no sale en dos bloques de novedades
  return { generated: new Date().toISOString(), mejores, novedades, estrenos };
}
