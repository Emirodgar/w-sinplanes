import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { load as yamlLoad } from 'js-yaml';
import { ROOT, slugify } from './util.mjs';

const day = (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : v ? String(v).slice(0, 10) : null);

/** Ediciones anteriores escritas a mano en config/historico.yml, por id de cita, de la más reciente a la más antigua. */
export function readHistorico() {
  const file = path.join(ROOT, 'config/historico.yml');
  if (!existsSync(file)) return {};
  const doc = yamlLoad(readFileSync(file, 'utf8')) || {};
  const out = {};
  for (const [id, list] of Object.entries(doc)) {
    const eds = (Array.isArray(list) ? list : [])
      .map((e) => ({
        year: Number(e.anio) || Number(String(day(e.inicio)).slice(0, 4)),
        start: day(e.inicio), end: day(e.fin) || day(e.inicio),
        summary: e.resumen || '', figures: e.cifras || [],
        ...(e.enlace ? { url: e.enlace, urlName: e.enlace_nombre || null } : {}),
      }))
      .filter((e) => e.year && e.start && e.summary)
      .sort((a, b) => b.year - a.year);
    if (eds.length) out[id] = eds;
  }
  return out;
}

const CANDIDATES = 'data/historico-candidatos.json';
const MIN_SLUG = 6; // evita coincidencias con títulos demasiado cortos o genéricos

/**
 * Eventos de las agendas que ya han terminado y que son una edición de una cita anual (el título contiene el de la cita o un alias,
 * y la provincia coincide si la cita es local). Se acumulan en data/historico-candidatos.json como lista de trabajo del histórico manual.
 */
export function updateCandidates(events, today, citas, historico) {
  const file = path.join(ROOT, CANDIDATES);
  const stored = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : [];
  const byKey = new Map(stored.map((c) => [`${c.cita}|${c.start}`, c]));

  for (const ev of events) {
    const end = ev.end || ev.start;
    if (end >= today) continue;
    const evSlug = slugify(ev.title?.es || '');
    for (const c of citas) {
      const names = [c.titulo, ...(c.alias || [])].map(slugify).filter((s) => s.length >= MIN_SLUG);
      if (!names.some((n) => evSlug.includes(n))) continue;
      if (c.provincia && slugify(ev.place?.provincia || '') !== slugify(c.provincia)) continue;
      byKey.set(`${c.id}|${ev.start}`, {
        cita: c.id, start: ev.start, end, title: ev.title.es, municipio: ev.place?.municipio || null,
        url: ev.source?.url || null, fuente: ev.source?.name || null,
      });
    }
  }
  // Ya redactadas en el histórico (mismo año) → fuera de la lista de trabajo
  const done = (c) => (historico[c.cita] || []).some((e) => e.year === Number(c.start.slice(0, 4)));
  const list = [...byKey.values()].filter((c) => !done(c)).sort((a, b) => a.start.localeCompare(b.start));
  writeFileSync(file, JSON.stringify(list, null, 2));
  return list;
}
