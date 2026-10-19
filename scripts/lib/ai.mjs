import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { ROOT, TOPIC_IDS, hash } from './util.mjs';

export const MODEL = process.env.SINPLANES_MODEL || 'claude-haiku-5-5';
const MAX_ITEMS = Number(process.env.SINPLANES_MAX_AI_ITEMS || 300); // tope de coste por ejecución
const BATCH = 20;

export const aiEnabled = () => Boolean(process.env.ANTHROPIC_API_KEY);

/** Cachés en data/cache/<nombre>.json: lo que ya se ha pagado una vez no se vuelve a pagar. */
export function readCache(name) {
  const file = path.join(ROOT, `data/cache/${name}.json`);
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
}
export function writeCache(name, cache) {
  const file = path.join(ROOT, `data/cache/${name}.json`);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(cache, null, 1));
}
const loadCache = () => readCache('ai');
const saveCache = (c) => writeCache('ai', c);

const SYSTEM = `Eres el editor de sinplanes.com, una agenda de planes en España.
Recibes eventos en JSON. Para cada uno devuelve un objeto con:
- id: el mismo id recibido
- es: { titulo, resumen }  título claro en español (máx. 80 caracteres) y resumen propio de 1-2 frases (máx. 220 caracteres). Redacta con tus palabras; no copies frases del original. No inventes datos que no estén en el texto.
- en: { titulo, resumen }  lo mismo en inglés natural para un visitante extranjero.
- temas: entre 1 y 3 de esta lista exacta: ${TOPIC_IDS.join(', ')}
- a_cubierto: true, false o null si no se puede saber
Responde SOLO con un array JSON válido, sin texto adicional ni bloques de código.`;

/** Llama a Claude con un prompt de sistema y una carga JSON; devuelve el JSON de la respuesta. */
export async function claudeJSON(system, payload, { maxTokens = 8000, model = MODEL } = {}) {
  const base = process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com';
  const res = await fetch(`${base}/v1/messages`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: JSON.stringify(payload) }],
    }),
    signal: AbortSignal.timeout(120000),
  });
  if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text = data.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  return JSON.parse(text.replace(/```json|```/g, '').trim());
}
const callClaude = (items) => claudeJSON(SYSTEM, items);

/**
 * Enriquece planes de fuentes externas. Usa caché por contenido: un evento que no cambia
 * no se vuelve a enviar nunca. Si no hay clave de API, devuelve los planes tal cual.
 */
export async function enrich(plans, log = console.log) {
  if (!aiEnabled()) { log('IA desactivada (sin ANTHROPIC_API_KEY): se usan reglas y texto original.'); return plans; }
  const cache = loadCache();
  const keyOf = (p) => hash(`${p.title.es}|${p.rawText}`);
  const pending = plans.filter((p) => !p.title.en && !cache[keyOf(p)]).slice(0, MAX_ITEMS);
  log(`IA: ${pending.length} planes nuevos para enriquecer (${plans.length - pending.length} en caché o fuera del tope).`);

  for (let i = 0; i < pending.length; i += BATCH) {
    const chunk = pending.slice(i, i + BATCH);
    const payload = chunk.map((p) => ({ id: p.id, titulo: p.title.es, texto: p.rawText.slice(0, 1200), idioma_origen: p.lang, lugar: p.place.municipio }));
    try {
      const results = await callClaude(payload);
      for (const r of results) {
        const p = chunk.find((x) => x.id === r.id);
        if (p) cache[keyOf(p)] = r;
      }
    } catch (err) {
      log(`IA: lote ${i / BATCH + 1} falló (${err.message}). Se reintentará mañana.`);
    }
  }
  saveCache(cache);

  return plans.map((p) => {
    const r = cache[keyOf(p)];
    if (!r) return p;
    const topics = (r.temas || []).filter((t) => TOPIC_IDS.includes(t));
    return {
      ...p,
      title: { es: r.es?.titulo || p.title.es, ...(r.en?.titulo || p.title.en ? { en: r.en?.titulo || p.title.en } : {}) },
      summary: { es: r.es?.resumen || p.summary.es, ...(r.en?.resumen || p.summary.en ? { en: r.en?.resumen || p.summary.en } : {}) },
      topics: topics.length ? topics : p.topics,
      indoor: typeof r.a_cubierto === 'boolean' ? r.a_cubierto : p.indoor,
    };
  });
}
