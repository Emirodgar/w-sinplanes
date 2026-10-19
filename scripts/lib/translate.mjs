// Traducción a francés, alemán, italiano y portugués con caché por contenido.
// El texto fuente es el español (y el inglés como apoyo). Lo ya traducido nunca se vuelve a pedir.
import { hash, addDays } from './util.mjs';
import { aiEnabled, budgetError, llmJSON, readCache, writeCache } from './ai.mjs';

export const TARGET_LANGS = ['fr', 'de', 'it', 'pt'];
const NEAR_DAYS = 21; // los eventos de datos abiertos solo se traducen si ocurren pronto
const MAX_ITEMS = Number(process.env.SINPLANES_MAX_TRANSLATE || 100); // tope de planes nuevos por ejecución
const BATCH = 20;

const SYSTEM = `Eres traductor de sinplanes.com, una agenda de planes y eventos en España para visitantes extranjeros.
Recibes planes en JSON con titulo y resumen en español (y en inglés como apoyo). Para cada uno devuelve un objeto:
{ "id": <mismo id>, "fr": {"titulo","resumen"}, "de": {...}, "it": {...}, "pt": {...} }
Reglas:
- Traduce de forma natural, con tono claro y cercano; no añadas datos que no estén en el original.
- Los nombres propios y nombres oficiales de fiestas o eventos se mantienen en español (Feria de Abril, La Tomatina, Sant Jordi). Si existe una traducción habitual y reconocible, úsala (Semana Santa → Holy Week en inglés, Semaine sainte, Karwoche, Settimana Santa, Semana Santa en portugués).
- El portugués es el de Portugal.
- Respeta la longitud: título máx. 90 caracteres, resumen máx. 260.
Responde SOLO con un array JSON válido, sin texto adicional ni bloques de código.`;

const keyOf = (p) => hash(`${p.title.es}|${p.summary.es}`);
const missing = (p) => TARGET_LANGS.some((l) => !p.title[l]);

function apply(p, tr) {
  const title = { ...p.title };
  const summary = { ...p.summary };
  for (const l of TARGET_LANGS) {
    if (tr?.[l]?.titulo) {
      title[l] = String(tr[l].titulo).slice(0, 140);
      summary[l] = String(tr[l].resumen || '').slice(0, 400);
    }
  }
  return { ...p, title, summary };
}

const valid = (r) => r && TARGET_LANGS.every((l) => typeof r[l]?.titulo === 'string' && r[l].titulo.trim());

/**
 * Añade title/summary en fr, de, it y pt. Se traduce lo que más le sirve a un visitante extranjero:
 * el calendario propio (estable: se traduce una vez para siempre), los planes extraídos de prensa y los
 * eventos de datos abiertos que ocurren en las próximas semanas. Orden de prioridad: ese mismo.
 */
/** Aplica las traducciones ya cacheadas (sin red ni IA). Es lo que usa el build del sitio. */
export const applyCachedTranslations = (plans) => {
  const cache = readCache('translations');
  return plans.map((p) => (cache[keyOf(p)] ? apply(p, cache[keyOf(p)]) : p));
};

export async function translatePlans(plans, today, log = console.log) {
  const cache = readCache('translations');
  const own = (p) => p.source?.name === 'sinplanes';
  const rank = (p) => (own(p) ? 0 : p.ai ? 1 : 2);
  const eligible = (p) => own(p) || p.ai || (p.start || '') <= addDays(today, NEAR_DAYS);
  const queue = plans
    .filter((p) => missing(p) && eligible(p) && !cache[keyOf(p)])
    .sort((a, b) => rank(a) - rank(b) || (a.start || '').localeCompare(b.start || ''));

  if (queue.length && !aiEnabled()) {
    log(`Traducción: ${queue.length} planes sin traducir y la IA no está disponible (sin clave o cuota agotada). Esas páginas saldrán en inglés/español y con noindex.`);
  } else if (queue.length) {
    const todo = queue.slice(0, MAX_ITEMS);
    log(`Traducción: ${todo.length} planes nuevos (${queue.length - todo.length} aplazados por el tope de ${MAX_ITEMS}).`);
    for (let i = 0; i < todo.length; i += BATCH) {
      const chunk = todo.slice(i, i + BATCH);
      const payload = chunk.map((p) => ({ id: p.id, titulo: p.title.es, resumen: p.summary.es, en: { titulo: p.title.en, resumen: p.summary.en } }));
      try {
        const results = await llmJSON(SYSTEM, payload, { maxTokens: 16000 });
        for (const r of results) {
          const p = chunk.find((x) => x.id === r.id);
          if (p && valid(r)) cache[keyOf(p)] = Object.fromEntries(TARGET_LANGS.map((l) => [l, r[l]]));
        }
      } catch (err) {
        log(`Traducción: lote ${i / BATCH + 1} falló (${err.message}). Se reintentará mañana.`);
        if (budgetError(err)) break;
      }
    }
    writeCache('translations', cache);
  }
  return plans.map((p) => (cache[keyOf(p)] ? apply(p, cache[keyOf(p)]) : p));
}
