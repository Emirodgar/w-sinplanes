// Señal de tendencias: búsquedas en alza en Google (España). No genera páginas: solo reordena y destaca.
//
// El RSS diario solo trae ~10 búsquedas, así que se guarda un historial de 14 días en data/trends.json
// y cada término pierde peso con los días. Un plan "conecta" con una tendencia si el término aparece
// en su título o municipio, no en el resumen (todas las palabras significativas del término).
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { ROOT, addDays, slugify, getText } from './util.mjs';
import { parseFeed, tag, tagAll } from './xml.mjs';

const FEED = 'https://trends.google.com/trending/rss?geo=ES';
const WINDOW_DAYS = 14;
const MIN_WORD = 4;

/** "200+" → 200, "2 M+" → 2.000.000, "50 K+" → 50.000 */
export function parseTraffic(s = '') {
  const m = String(s).replace(/\./g, '').match(/([\d,]+)\s*([KkMm])?/);
  if (!m) return 0;
  const n = Number(m[1].replace(',', '.')) || 0;
  return Math.round(n * ({ k: 1e3, m: 1e6 }[(m[2] || '').toLowerCase()] || 1));
}

export async function fetchTrends() {
  const items = parseFeed(await getText(FEED));
  return items.map((it) => ({
    term: it.title,
    traffic: parseTraffic(tag(it.raw, 'ht:approx_traffic')),
    news: tagAll(it.raw, 'ht:news_item_title').slice(0, 3),
  })).filter((x) => x.term);
}

const words = (s) => slugify(s).split('-').filter((w) => w.length >= MIN_WORD);

/** Fusiona lo de hoy con el historial (data/trends.json) y descarta lo caducado. */
export function mergeHistory(history, today, fetched) {
  const byTerm = new Map(history.map((h) => [h.term, h]));
  for (const f of fetched) {
    const prev = byTerm.get(f.term);
    byTerm.set(f.term, { term: f.term, traffic: Math.max(f.traffic, prev?.traffic || 0), lastSeen: today, news: f.news });
  }
  const min = addDays(today, -WINDOW_DAYS);
  return [...byTerm.values()].filter((h) => h.lastSeen >= min).sort((a, b) => b.traffic - a.traffic);
}

const daysBetween = (a, b) => Math.round((new Date(b + 'T12:00:00Z') - new Date(a + 'T12:00:00Z')) / 864e5);

// Un término que conecta con demasiados planes ("madrid", "navidad") es ruido, no señal.
const MAX_MATCHES = 8;

/** Añade `trend` (0-100) a los planes que conectan con alguna búsqueda en alza. */
export function applyTrends(plans, history, today) {
  const terms = history
    .map((h) => ({ ...h, w: words(h.term), decay: Math.max(0, 1 - daysBetween(h.lastSeen, today) / WINDOW_DAYS) }))
    .filter((h) => h.w.length > 0 && h.decay > 0);
  const hay = plans.map((p) => new Set(words(`${p.title.es} ${p.place?.municipio || ''} ${p.place?.provincia || ''}`)));
  const score = new Array(plans.length).fill(0);
  for (const h of terms) {
    const hits = hay.flatMap((set, i) => (h.w.every((w) => set.has(w)) ? [i] : []));
    if (!hits.length || hits.length > MAX_MATCHES) continue;
    // Escala logarítmica: 200+ ≈ 23, 10K+ ≈ 40, 1M+ ≈ 60, ajustada por frescura
    const sc = Math.round(Math.log10(Math.max(h.traffic, 10)) * 10 * h.decay);
    for (const i of hits) score[i] = Math.max(score[i], sc);
  }
  return plans.map((p, i) => (score[i] > 0 ? { ...p, trend: score[i] } : p));
}

const FILE = path.join(ROOT, 'data/trends.json');

export function saveTrends(history, today) {
  mkdirSync(path.dirname(FILE), { recursive: true });
  writeFileSync(FILE, JSON.stringify({ updated: today, terms: history }, null, 1));
}

export const readHistory = () => (existsSync(FILE) ? JSON.parse(readFileSync(FILE, 'utf8')).terms || [] : []);
