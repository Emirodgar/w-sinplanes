import { getJSON, todayISO, addDays } from '../lib/util.mjs';

// Próximos estrenos de cine en España según TMDB. Requiere TMDB_API_KEY (gratuita).
export default async function tmdb(src) {
  const key = process.env[src.secreto];
  const today = todayISO();
  const horizon = addDays(today, 30);
  const out = [];
  for (const page of [1, 2]) {
    const data = await getJSON(`https://api.themoviedb.org/3/movie/upcoming?region=ES&language=es-ES&page=${page}&api_key=${key}`);
    out.push(...(data.results || []));
  }
  return out
    .filter((m) => m.release_date >= today && m.release_date <= horizon)
    .sort((a, b) => b.popularity - a.popularity)
    .slice(0, src.max || 8)
    .map((m) => ({
      title: `Estreno en cines: ${m.title}`,
      description: m.overview || '',
      start: m.release_date, end: m.release_date, time: null,
      url: `https://www.themoviedb.org/movie/${m.id}`,
      scope: 'nacional', kind: 'pantalla', topics: ['pantalla', 'cultura'],
      indoor: true, free: false, price: null, hints: ['cine'], lang: 'es',
    }));
}
