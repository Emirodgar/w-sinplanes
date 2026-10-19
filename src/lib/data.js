import plansRaw from '../../data/plans.json';
import meta from '../../data/meta.json';
import topics from '../../config/topics.json';
import geo from '../../config/geo.json';
import { monthName, INTL_LOCALE, t } from '../i18n/ui.js';

export { meta, topics, geo };
export const TODAY = meta.today;
export const plans = plansRaw;

export const slugify = (s = '') => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

export const isPast = (p) => !!p.end && p.end < TODAY;
export const isDated = (p) => p.kind !== 'estacional';
export const upcoming = (list = plans) => list.filter((p) => isDated(p) && !isPast(p));
export const overlaps = (p, from, to) => p.start <= to && (p.end || p.start) >= from;
export const currentMonth = () => Number(TODAY.slice(5, 7));
export const seasonalFor = (m) => plans.filter((p) => p.kind === 'estacional' && p.months.includes(m));
export const within = (days) => upcoming().filter((p) => p.start <= addDays(TODAY, days));

export function weekendRange() {
  const dow = new Date(TODAY + 'T12:00:00Z').getUTCDay(); // 0 = domingo
  if (dow === 0) return [TODAY, TODAY];
  if (dow >= 5) return [TODAY, addDays(TODAY, 7 - dow)];
  return [addDays(TODAY, 5 - dow), addDays(TODAY, 7 - dow)];
}

export const topicById = (id) => topics.find((t) => t.id === id);

export function inMonth(m) {
  const mm = String(m).padStart(2, '0');
  return {
    seasonal: seasonalFor(m),
    dated: upcoming().filter((p) => p.start.slice(5, 7) === mm || p.end?.slice(5, 7) === mm),
  };
}

export const byTopic = (id) => plans.filter((p) => p.topics?.includes(id) && !isPast(p));
export const byCcaa = (slug) => upcoming().filter((p) => p.place?.ccaa === slug);
export const byProvince = (slug, prov) => byCcaa(slug).filter((p) => slugify(p.place.provincia) === prov);

/* ---------- Textos con respaldo: idioma -> inglés -> español ---------- */
export function pickText(obj, lang) {
  for (const l of [lang, 'en', 'es']) if (obj?.[l]) return { text: obj[l], lang: l };
  return { text: '', lang: 'es' };
}
export const ptitle = (p, lang) => pickText(p.title, lang).text;
export const psummary = (p, lang) => pickText(p.summary, lang).text;
/** Idioma real del texto cuando no coincide con el de la página (para el atributo lang y noindex). */
export const textLang = (lang, p) => {
  const l = pickText(p.title, lang).lang;
  return l !== lang ? l : undefined;
};
/**
 * ¿Existe el plan en este idioma? El español siempre; el resto, si tiene traducción propia o, al menos,
 * inglés (que se muestra como respaldo y sale con noindex). Los eventos sin inglés solo existen en español.
 */
export const hasText = (p, lang) => lang === 'es' || Boolean(p.title?.[lang] || p.title?.en);
export const inLang = (list, lang) => list.filter((p) => hasText(p, lang));
/** Idiomas en los que el plan tiene texto propio (para hreflang). */
export const availLangs = (p, all) => all.filter((l) => l === 'es' || p.title?.[l]);

/* ---------- Formato ---------- */
export function fmtDay(lang, iso, opts = { weekday: 'long', day: 'numeric', month: 'long' }) {
  return new Intl.DateTimeFormat(INTL_LOCALE[lang], { ...opts, timeZone: 'UTC' }).format(new Date(iso + 'T12:00:00Z'));
}
export function fmtWhen(lang, p) {
  const L = t[lang];
  if (p.kind === 'estacional') {
    const names = p.months.map((m) => monthName(lang, m));
    if (names.length === 12) return L.allYear;
    return names.length > 1 ? `${names.slice(0, -1).join(', ')} ${L.and} ${names.at(-1)}` : names[0];
  }
  const short = { day: 'numeric', month: 'short' };
  const same = !p.end || p.end === p.start;
  const base = same ? fmtDay(lang, p.start) : `${fmtDay(lang, p.start, short)} – ${fmtDay(lang, p.end, short)}`;
  return p.time ? `${base}, ${p.time}` : base;
}
export function fmtPlace(p, allSpain) {
  const pl = p.place || {};
  if (pl.scope !== 'local') return allSpain;
  return [pl.municipio, pl.provincia !== pl.municipio ? pl.provincia : null].filter(Boolean).join(', ');
}
export const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** Planes que conectan con las búsquedas en tendencia (la señal la calcula el pipeline). */
export const trending = (n = 5) =>
  plans
    .filter((p) => p.trend && (isDated(p) ? !isPast(p) : p.months.includes(currentMonth())))
    .sort((a, b) => b.trend - a.trend)
    .slice(0, n);

/** Reordena de forma estable: lo que está en tendencia sube; a igualdad, se mantiene el orden por fecha. */
export const boost = (list) => [...list].sort((a, b) => (b.trend || 0) - (a.trend || 0));
