// Extracción de planes desde titulares de prensa con IA.
//
// Flujo: el adaptador `rss` entrega candidatos (titular + entradilla) → aquí un modelo pequeño decide
// si anuncian un plan con fecha y, si es así, lo estructura. Todo se guarda en caché (data/cache/press.json),
// de modo que (1) nunca se paga dos veces por el mismo titular y (2) un evento sigue publicado cuando el
// titular ya ha salido del feed.
//
// Calidad: lo que la IA marca con poca confianza NO se publica. Va a data/review.json y el workflow abre
// un Issue. Decisión humana en config/revision.json: aprobados / rechazados (por id).
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { ROOT, TOPIC_IDS, hash, addDays, resolveProvince, slugify } from './util.mjs';
import { aiEnabled, budgetError, llmJSON, readCache, writeCache } from './ai.mjs';

export const CONF_MIN = Number(process.env.SINPLANES_CONF_MIN || 0.7);
const MAX_CANDIDATES = Number(process.env.SINPLANES_MAX_PRESS || 60); // tope de titulares nuevos por ejecución
const BATCH = 15;
const REGION_REVIEW_CAP = 0.5; // plan local sin provincia reconocible: siempre a revisión

const SYSTEM = `Eres el editor de sinplanes.com, una agenda de planes y eventos en España.
Recibes un objeto {"hoy": "YYYY-MM-DD", "items": [...]} con titulares de prensa (id, titulo, texto, publicado, region_pista).
Para cada item decide si ANUNCIA un plan al que el público puede asistir o que puede ver: concierto, festival,
feria, fiesta, exposición, estreno, ruta, mercado, evento deportivo o televisado de interés general, premio literario con acto, etc.
NO son planes: noticias de hechos ya ocurridos, resultados deportivos, política, sucesos, críticas, obituarios,
entrevistas sin evento, cierres u obras, o cualquier cosa sin fecha identificable en el futuro.

Devuelve un array con un objeto por item:
{
  "id": mismo id recibido,
  "es_plan": true | false,
  "titulo": título claro en español (máx. 80 caracteres),
  "resumen": resumen PROPIO de 1-2 frases (máx. 220 caracteres). Redáctalo con tus palabras, no copies frases del texto,
  "en": { "titulo": ..., "resumen": ... }  lo mismo en inglés natural,
  "inicio": "YYYY-MM-DD" | null,
  "fin": "YYYY-MM-DD" | null  (null si dura un solo día),
  "hora": "HH:MM" | null,
  "lugar": sala, recinto o espacio | null,
  "municipio": municipio | null,
  "provincia": nombre oficial de la provincia en español | null,
  "ambito": "local" si ocurre en un lugar concreto o "nacional" si es para todo el país (p. ej. emisión televisada),
  "gratis": true | false | null,
  "precio": texto breve | null,
  "temas": entre 1 y 3 de esta lista exacta: ${TOPIC_IDS.join(', ')},
  "a_cubierto": true | false | null,
  "confianza": número de 0 a 1
}
Reglas:
- Resuelve fechas relativas ("este sábado", "el próximo jueves") con "publicado". Si no hay año, es la próxima fecha posible desde "hoy".
- NUNCA inventes fechas, lugares ni precios que no estén en el texto. Si falta un dato, pon null.
- Si es_plan es false, el resto de campos pueden ser null.
- confianza: 0.85 o más si fecha y lugar aparecen de forma explícita; entre 0.6 y 0.85 si has tenido que inferir algo;
  por debajo de 0.6 si hay dudas de que sea un plan, de la fecha o del lugar.
Responde SOLO con un array JSON válido, sin texto adicional ni bloques de código.`;

const isoOk = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s + 'T12:00:00Z'));
const timeOk = (s) => (typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s) ? s : null);
const idOf = (c) => hash(c.url || c.title);

export function readRevision() {
  const file = path.join(ROOT, 'config/revision.json');
  const base = { aprobados: [], rechazados: [] };
  return existsSync(file) ? { ...base, ...JSON.parse(readFileSync(file, 'utf8')) } : base;
}

/** Valida y limpia la respuesta de la IA; devuelve null si no sirve como plan. */
function clean(r, c, today) {
  if (!r || !r.es_plan || !isoOk(r.inicio) || !r.titulo) return { es_plan: false };
  const inicio = r.inicio;
  let fin = isoOk(r.fin) && r.fin >= inicio ? r.fin : inicio;
  if (inicio < addDays(c.published || today, -1)) return { es_plan: false }; // fecha anterior a la noticia: dato dudoso
  let confianza = Math.max(0, Math.min(1, Number(r.confianza) || 0));
  const local = r.ambito !== 'nacional';
  if (local && !resolveProvince(r.provincia)) confianza = Math.min(confianza, REGION_REVIEW_CAP);
  const temas = (r.temas || []).filter((x) => TOPIC_IDS.includes(x));
  return {
    es_plan: true,
    titulo: String(r.titulo).slice(0, 120),
    resumen: String(r.resumen || '').slice(0, 300),
    en: r.en?.titulo ? { titulo: String(r.en.titulo).slice(0, 120), resumen: String(r.en.resumen || '').slice(0, 300) } : null,
    inicio, fin, hora: timeOk(r.hora),
    lugar: r.lugar || null, municipio: r.municipio || null, provincia: r.provincia || null,
    ambito: local ? 'local' : 'nacional',
    gratis: typeof r.gratis === 'boolean' ? r.gratis : null,
    precio: r.precio || null,
    temas, a_cubierto: typeof r.a_cubierto === 'boolean' ? r.a_cubierto : null,
    confianza,
  };
}

/**
 * candidates: salida de los adaptadores `rss` (cada uno con _src).
 * Devuelve { events, review } y deja escrito data/review.json.
 */
export async function extractPress(candidates, today, log = console.log) {
  const cache = readCache('press');
  // Los periódicos de un mismo grupo repiten noticias: un titular igual se analiza una sola vez.
  const seenTitles = new Set();
  const unique = candidates.filter((c) => { const k = slugify(c.title); return !seenTitles.has(k) && seenTitles.add(k); });
  const fresh = unique.filter((c) => !cache[idOf(c)]).sort((a, b) => (b.published || '').localeCompare(a.published || ''));

  if (fresh.length && !aiEnabled()) {
    log(`Prensa: ${fresh.length} titulares nuevos pero la IA no está disponible (sin clave o cuota agotada): no se procesan.`);
  } else if (fresh.length) {
    const todo = fresh.slice(0, MAX_CANDIDATES);
    log(`Prensa: ${todo.length} titulares nuevos para analizar (${fresh.length - todo.length} aplazados por el tope de ${MAX_CANDIDATES}).`);
    for (let i = 0; i < todo.length; i += BATCH) {
      const chunk = todo.slice(i, i + BATCH);
      const payload = {
        hoy: today,
        items: chunk.map((c) => ({ id: idOf(c), titulo: c.title, texto: c.text, publicado: c.published, region_pista: c._src.region || c._src.provincia || null })),
      };
      try {
        const results = await llmJSON(SYSTEM, payload, { maxTokens: 12000 });
        const byId = new Map(results.map((r) => [r.id, r]));
        for (const c of chunk) {
          const id = idOf(c);
          const meta = { url: c.url, fuente: c._src.nombre, src: c._src.id, publicado: c.published };
          cache[id] = { ...meta, ...clean(byId.get(id), c, today) };
        }
      } catch (err) {
        log(`Prensa: lote ${i / BATCH + 1} falló (${err.message}). Se reintentará mañana.`);
        if (budgetError(err)) break;
      }
    }
  }

  // Poda: lo que no es plan se olvida a las 2 semanas; los planes, 40 días después de acabar.
  for (const [id, r] of Object.entries(cache)) {
    const old = r.es_plan ? (r.fin || r.inicio) < addDays(today, -40) : (r.publicado || '') < addDays(today, -14);
    if (old) delete cache[id];
  }
  if (Object.keys(cache).length) writeCache('press', cache);

  // Los eventos salen de TODA la caché, no solo de los titulares de hoy.
  const rev = readRevision();
  const events = [];
  const review = [];
  for (const [id, r] of Object.entries(cache)) {
    if (!r.es_plan || rev.rechazados.includes(id)) continue;
    const approved = rev.aprobados.includes(id);
    if (r.confianza < CONF_MIN && !approved) {
      if ((r.fin || r.inicio) >= today) review.push({ id, titulo: r.titulo, inicio: r.inicio, municipio: r.municipio, provincia: r.provincia, confianza: r.confianza, fuente: r.fuente, url: r.url });
      continue;
    }
    events.push({
      title: r.titulo, description: r.resumen, title_en: r.en?.titulo, summary_en: r.en?.resumen,
      start: r.inicio, end: r.fin, time: r.hora, url: r.url, venue: r.lugar,
      municipio: r.municipio, provincia: r.provincia, scope: r.ambito === 'nacional' ? 'nacional' : undefined,
      free: r.gratis === true, price: r.precio, topics: r.temas.length ? r.temas : undefined, indoor: r.a_cubierto ?? undefined,
      kind: r.temas[0] === 'pantalla' ? 'pantalla' : 'evento', lang: 'es',
      _src: { id: r.src, nombre: r.fuente, licencia: null }, ai: true, confidence: r.confianza,
    });
  }

  mkdirSync(path.join(ROOT, 'data'), { recursive: true });
  writeFileSync(path.join(ROOT, 'data/review.json'), JSON.stringify(review, null, 1));
  log(`Prensa: ${events.length} planes publicables, ${review.length} pendientes de revisión.`);
  return { events, review };
}
