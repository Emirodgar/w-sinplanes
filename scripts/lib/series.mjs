import { getJSON, addDays } from './util.mjs';

// Series actuales y muy bien valoradas según TMDB (clave gratuita en TMDB_API_KEY). No usa IA.
// Criterio: nota >= 7,5 con >= 500 votos, con episodios emitidos en los últimos 12 meses y disponibles en una plataforma en España.
const API = 'https://api.themoviedb.org/3';
const LOCALES = { es: 'es-ES', en: 'en-US', fr: 'fr-FR', de: 'de-DE', it: 'it-IT', pt: 'pt-PT' };
const MIN_RATING = 7.5;
const MIN_VOTES = 500;
const EXCLUDED_GENRES = '10763,10767,10764'; // noticias, tertulias y reality: no son "series" en el sentido que busca el lector
const KIDS_GENRES = new Set([16, 10762, 10751]); // animación, infantil, familia
const KIDS_CERT = new Set(['TP', '7', 'A', 'TV-Y', 'TV-Y7', 'TV-G']);
const ADULT_CERT = new Set(['16', '18', 'TV-14', 'TV-MA']);
const MAX_PLATFORMS = 3;

/** A quién va dirigida: la calificación por edades manda; si no hay o es intermedia, decide el género. */
export function seriesAudience(cert, genreIds) {
  if (KIDS_CERT.has(cert)) return 'ninos';
  if (ADULT_CERT.has(cert)) return 'adultos';
  return genreIds.some((g) => KIDS_GENRES.has(g)) ? 'ninos' : 'adultos';
}

const discover = async (key, locale, today, pages = 2) => {
  const params = new URLSearchParams({
    language: locale, watch_region: 'ES', with_watch_monetization_types: 'flatrate|free|ads',
    sort_by: 'popularity.desc', 'vote_average.gte': String(MIN_RATING), 'vote_count.gte': String(MIN_VOTES),
    'air_date.gte': addDays(today, -365), 'air_date.lte': today, without_genres: EXCLUDED_GENRES, api_key: key,
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

export async function fetchSeries(key, today, { max = 14 } = {}) {
  const es = (await discover(key, LOCALES.es, today))
    .filter((s) => s.poster_path && !s.adult)
    .slice(0, max);
  if (!es.length) throw new Error('TMDB no devolvió series que cumplan el criterio');

  const titles = { es: Object.fromEntries(es.map((s) => [s.id, s.name])) };
  for (const [lang, locale] of Object.entries(LOCALES)) {
    if (lang === 'es') continue;
    try { titles[lang] = Object.fromEntries((await discover(key, locale, today)).map((s) => [s.id, s.name])); }
    catch { titles[lang] = {}; }
  }

  const series = [];
  for (const s of es) {
    const [cert, where] = await Promise.all([spanishRating(key, s.id), platforms(key, s.id)]);
    series.push({
      id: s.id,
      titulo: Object.fromEntries(Object.keys(LOCALES).map((l) => [l, titles[l]?.[s.id] || s.name])),
      poster: s.poster_path,
      nota: Math.round(s.vote_average * 10) / 10,
      anio: s.first_air_date ? Number(s.first_air_date.slice(0, 4)) : null,
      plataformas: where,
      publico: seriesAudience(cert, s.genre_ids || []),
    });
  }
  return { generated: new Date().toISOString(), series };
}
