import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const readJSON = (rel) => JSON.parse(readFileSync(path.join(ROOT, rel), 'utf8'));

export const TOPICS = readJSON('config/topics.json');
export const TOPIC_IDS = TOPICS.map((t) => t.id);
const GEO = readJSON('config/geo.json');

export function slugify(s = '') {
  return String(s)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export const hash = (s) => createHash('sha1').update(String(s)).digest('hex').slice(0, 10);

export function stripHtml(s = '') {
  return String(s)
    .replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ').trim();
}

export function truncate(s = '', n = 260) {
  if (s.length <= n) return s;
  const cut = s.slice(0, n);
  return cut.slice(0, cut.lastIndexOf(' ')) + '…';
}

/** Devuelve 'YYYY-MM-DD' o null a partir de casi cualquier formato de fecha. */
export function toDay(v) {
  if (!v) return null;
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  m = s.match(/^(\d{4})(\d{2})(\d{2})/); // iCal
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const d = new Date(s);
  return isNaN(d) ? null : d.toISOString().slice(0, 10);
}

/** Hora 'HH:MM' si la cadena la trae y no es medianoche vacía. */
export function toTime(v) {
  const m = String(v || '').match(/[T\s](\d{2}):?(\d{2})/);
  if (!m || (m[1] === '00' && m[2] === '00')) return null;
  return `${m[1]}:${m[2]}`;
}

export const todayISO = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
export function addDays(iso, n) {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/* ---------- Geografía ---------- */
const norm = (s) => slugify(s).replace(/-/g, '');
const PROV_ALIASES = {
  alicante: 'Alicante', alacant: 'Alicante', castellon: 'Castellón', castello: 'Castellón',
  valencia: 'Valencia', araba: 'Álava', alava: 'Álava', arabaalava: 'Álava', vizcaya: 'Bizkaia',
  bizkaia: 'Bizkaia', guipuzcoa: 'Gipuzkoa', gipuzkoa: 'Gipuzkoa', lacoruna: 'A Coruña', acoruna: 'A Coruña',
  coruna: 'A Coruña', orense: 'Ourense', gerona: 'Girona', lerida: 'Lleida', baleares: 'Illes Balears',
  illesbalears: 'Illes Balears', islasbaleares: 'Illes Balears', oviedo: 'Asturias',
};
const PROV_INDEX = {};
for (const c of GEO) for (const p of c.provincias) PROV_INDEX[norm(p)] = { provincia: p, ccaa: c.slug };

export function resolveProvince(name) {
  if (!name) return null;
  const k = norm(name);
  const canonical = PROV_ALIASES[k] || null;
  return PROV_INDEX[canonical ? norm(canonical) : k] || null;
}

/* ---------- Clasificación por reglas (sin IA) ---------- */
const RULES = [
  ['navidad', /navidad|navideñ|belén|belen|reyes magos|cabalgata|nochevieja|campanadas/i],
  ['ninos', /infantil|niñ[oa]s|familia|familiar|peques|títeres|titeres|cuentacuentos|marionetas/i],
  ['libros', /libro|literari|lectura|poes[ií]a|biblioteca|club de lectura|escritor/i],
  ['musica', /concierto|m[uú]sica|jazz|[oó]pera|flamenco|orquesta|teatro|danza|zarzuela|recital|coro\b/i],
  ['cultura', /exposici[oó]n|museo|visita guiada|conferencia|charla|cine|proyecci[oó]n|patrimonio|arte\b/i],
  ['deporte', /carrera|marat[oó]n|deport|partido|torneo|campeonato|ciclismo|f[uú]tbol/i],
  ['gastronomia', /gastron|degustaci|vino|tapa|cata\b|jornadas del|queso|feria de la/i],
  ['fiestas', /fiesta|romer[ií]a|verbena|carnaval|procesi[oó]n|patronal|feria\b/i],
  ['naturaleza', /ruta|senderismo|naturaleza|parque natural|observaci[oó]n de aves|astronom|bosque/i],
];

export function guessTopics(text, hints = []) {
  const blob = `${text} ${hints.join(' ')}`;
  const found = RULES.filter(([, re]) => re.test(blob)).map(([id]) => id);
  return found.length ? [...new Set(found)].slice(0, 3) : ['cultura'];
}

export function guessIndoor(text) {
  if (/aire libre|al aire|parque|plaza|calle|ruta|playa|jard[ií]n|recinto ferial|campo/i.test(text)) return false;
  if (/museo|teatro|auditorio|biblioteca|sala\b|centro cultural|centro c[ií]vico|cine|palacio|conservatorio/i.test(text)) return true;
  return null;
}

/* ---------- HTTP ---------- */
export async function getJSON(url, { headers = {}, timeout = 25000 } = {}) {
  const res = await fetch(url, { headers: { 'user-agent': 'sinplanes/1.0 (+https://sinplanes.com)', accept: 'application/json', ...headers }, signal: AbortSignal.timeout(timeout) });
  if (!res.ok) throw new Error(`HTTP ${res.status} en ${url}`);
  return res.json();
}

export async function getText(url, { headers = {}, timeout = 25000 } = {}) {
  const res = await fetch(url, { headers: { 'user-agent': 'sinplanes/1.0 (+https://sinplanes.com)', ...headers }, signal: AbortSignal.timeout(timeout) });
  if (!res.ok) throw new Error(`HTTP ${res.status} en ${url}`);
  return res.text();
}

/** Primer valor no vacío entre varias claves posibles (las fuentes cambian nombres de campo). */
export function pick(obj, keys) {
  for (const k of keys) {
    const v = k.split('.').reduce((o, p) => (o == null ? o : o[p]), obj);
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return null;
}
