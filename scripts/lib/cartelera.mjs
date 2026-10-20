import { getJSON } from './util.mjs';

// Cartelera de cine en España según TMDB (clave gratuita en TMDB_API_KEY). No usa IA.
// Guarda lo mínimo para pintar un cartel: título por idioma, imagen, calificación por edades y a quién va dirigida.
const API = 'https://api.themoviedb.org/3';
const LOCALES = { es: 'es-ES', en: 'en-US', fr: 'fr-FR', de: 'de-DE', it: 'it-IT', pt: 'pt-PT' };
const FAMILY_GENRES = new Set([16, 10751]); // animación, familia
const KIDS_CERT = new Set(['TP', '7', 'A']); // todos los públicos y +7
const ADULT_CERT = new Set(['16', '18']);

/** A quién va dirigida: la calificación por edades manda; si no hay o es +12, decide el género. */
export function audience(cert, genreIds) {
  if (KIDS_CERT.has(cert)) return 'ninos';
  if (ADULT_CERT.has(cert)) return 'adultos';
  return genreIds.some((g) => FAMILY_GENRES.has(g)) ? 'ninos' : 'adultos';
}

const nowPlaying = async (key, locale, pages = 2) => {
  const out = [];
  for (let page = 1; page <= pages; page++) {
    const data = await getJSON(`${API}/movie/now_playing?region=ES&language=${locale}&page=${page}&api_key=${key}`);
    out.push(...(data.results || []));
  }
  return out;
};

async function spanishCertification(key, id) {
  try {
    const data = await getJSON(`${API}/movie/${id}/release_dates?api_key=${key}`);
    const es = (data.results || []).find((r) => r.iso_3166_1 === 'ES');
    const dates = (es?.release_dates || []).filter((d) => d.certification);
    return (dates.find((d) => d.type === 3) || dates[0])?.certification || null;
  } catch {
    return null; // sin calificación: se decide por género
  }
}

export async function fetchCartelera(key, { max = 14 } = {}) {
  const es = (await nowPlaying(key, LOCALES.es))
    .filter((m) => m.poster_path && !m.adult)
    .sort((a, b) => b.popularity - a.popularity)
    .slice(0, max);
  if (!es.length) throw new Error('TMDB no devolvió películas en cartelera');

  const titles = { es: Object.fromEntries(es.map((m) => [m.id, m.title])) };
  for (const [lang, locale] of Object.entries(LOCALES)) {
    if (lang === 'es') continue;
    try { titles[lang] = Object.fromEntries((await nowPlaying(key, locale)).map((m) => [m.id, m.title])); }
    catch { titles[lang] = {}; }
  }

  const peliculas = [];
  for (const m of es) {
    const cert = await spanishCertification(key, m.id);
    peliculas.push({
      id: m.id,
      titulo: Object.fromEntries(Object.keys(LOCALES).map((l) => [l, titles[l]?.[m.id] || m.title])),
      poster: m.poster_path,
      estreno: m.release_date || null,
      edad: cert,
      publico: audience(cert, m.genre_ids || []),
    });
  }
  return { generated: new Date().toISOString(), peliculas };
}
