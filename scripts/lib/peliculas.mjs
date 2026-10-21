import { getJSON, addDays } from './util.mjs';

// Películas de TMDB (clave gratuita en TMDB_API_KEY). No usa IA. Tres listas:
//   top     = las ~120 mejor puntuadas entre las muy votadas (>= 4000 votos), con sus géneros para clasificarlas
//   estrenos = en cartelera en España y estrenadas en los últimos 45 días (solo cine), de la más reciente a la más antigua
//   azar    = ~40 películas de todo el catálogo (>= 1000 votos, nota >= 6,3) que NO están en el top, con otras páginas cada día;
//             el navegador elige una al azar de esta bolsa
// La clave de TMDB no puede ir al navegador, por eso el azar sale de una bolsa que el cron renueva a diario.
const API = 'https://api.themoviedb.org/3';
const LOCALES = { es: 'es-ES', en: 'en-US', fr: 'fr-FR', de: 'de-DE', it: 'it-IT', pt: 'pt-PT' };
const TOP_PAGES = [1, 2, 3, 4, 5, 6]; // 20 por página
const TOP_MAX = 120;
const MIN_VOTES_SHOWN = 10;
const MAX_OVERVIEW = 320;
const POOL_PAGES = 4; // páginas aleatorias del catálogo
const POOL_RANGE = 40; // las páginas se sortean entre la 1 y la 40
const POOL_MAX = 40;

const get = (key, path, params) => getJSON(`${API}${path}?${new URLSearchParams({ api_key: key, ...params })}`);
const clip = (s) => (s && s.length > MAX_OVERVIEW ? `${s.slice(0, MAX_OVERVIEW).replace(/\s+\S*$/, '')}…` : s || '');
const shuffle = (a) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };

/** Mismas páginas en cada idioma: devuelve los resultados en español y, por idioma, un mapa id -> película. */
async function localized(key, path, params, pages) {
  const fetchAll = async (locale) => {
    const out = [];
    for (const page of pages) out.push(...((await get(key, path, { ...params, language: locale, page })).results || []));
    return out;
  };
  const es = await fetchAll(LOCALES.es);
  const names = { es: Object.fromEntries(es.map((m) => [m.id, m])) };
  for (const [lang, locale] of Object.entries(LOCALES)) {
    if (lang === 'es') continue;
    try { names[lang] = Object.fromEntries((await fetchAll(locale)).map((m) => [m.id, m])); }
    catch { names[lang] = {}; }
  }
  return { es, names };
}

async function genreNames(key) {
  const out = {};
  for (const [lang, locale] of Object.entries(LOCALES)) {
    try { for (const g of (await get(key, '/genre/movie/list', { language: locale })).genres || []) (out[g.id] ||= {})[lang] = g.name; }
    catch { /* sin ese idioma: se usa el de reserva (en, es) */ }
  }
  return out;
}

const item = (m, names, { overview = false } = {}) => ({
  id: m.id,
  titulo: Object.fromEntries(Object.keys(LOCALES).map((l) => [l, names[l]?.[m.id]?.title || m.title])),
  ...(overview && { sinopsis: Object.fromEntries(Object.keys(LOCALES).map((l) => [l, clip(names[l]?.[m.id]?.overview)]).filter(([, v]) => v)) }),
  poster: m.poster_path,
  nota: m.vote_count >= MIN_VOTES_SHOWN ? Math.round(m.vote_average * 10) / 10 : null, // con pocos votos la nota no significa nada
  anio: m.release_date ? Number(m.release_date.slice(0, 4)) : null,
  estreno: m.release_date || null,
  generos: m.genre_ids || [],
});

export async function fetchPeliculas(key, today) {
  const ok = (m) => m.poster_path && !m.adult;

  const topRaw = await localized(key, '/discover/movie', { sort_by: 'vote_average.desc', 'vote_count.gte': '4000', include_adult: 'false', region: 'ES' }, TOP_PAGES);
  const topMovies = topRaw.es.filter(ok).slice(0, TOP_MAX);
  if (!topMovies.length) throw new Error('TMDB no devolvió películas para el top');
  const top = topMovies.map((m) => item(m, topRaw.names, { overview: true }));
  const topIds = new Set(top.map((m) => m.id));

  let estrenos = [];
  try {
    const raw = await localized(key, '/movie/now_playing', { region: 'ES' }, [1, 2]);
    estrenos = raw.es
      .filter((m) => ok(m) && m.release_date >= addDays(today, -45) && m.release_date <= today)
      .sort((a, b) => b.release_date.localeCompare(a.release_date))
      .slice(0, 18)
      .map((m) => item(m, raw.names));
  } catch { /* opcional: el top se publica igualmente */ }

  let azar = [];
  try {
    const pages = shuffle(Array.from({ length: POOL_RANGE }, (_, i) => i + 1)).slice(0, POOL_PAGES);
    const raw = await localized(key, '/discover/movie', { sort_by: 'vote_count.desc', 'vote_count.gte': '1000', 'vote_average.gte': '6.3', include_adult: 'false' }, pages);
    azar = shuffle(raw.es.filter((m) => ok(m) && m.overview && !topIds.has(m.id))).slice(0, POOL_MAX).map((m) => item(m, raw.names, { overview: true }));
  } catch { /* opcional */ }

  return { generated: new Date().toISOString(), generos: await genreNames(key), top, estrenos, azar };
}
