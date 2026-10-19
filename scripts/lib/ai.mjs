import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { ROOT, TOPIC_IDS, hash } from './util.mjs';

// Proveedor de IA: Gemini si hay GEMINI_API_KEY; si no, Anthropic si hay ANTHROPIC_API_KEY.
const PROVIDER = process.env.GEMINI_API_KEY ? 'gemini' : process.env.ANTHROPIC_API_KEY ? 'anthropic' : null;
export const MODEL = process.env.SINPLANES_MODEL || (PROVIDER === 'anthropic' ? 'claude-haiku-5-5' : 'gemini-2.5-flash');
const MAX_ITEMS = Number(process.env.SINPLANES_MAX_AI_ITEMS || 300); // tope de coste por ejecución
const BATCH = 20;

export const aiEnabled = () => PROVIDER !== null;
export const AI_KEY_NAMES = 'GEMINI_API_KEY (o ANTHROPIC_API_KEY)';

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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const parseJSON = (text) => JSON.parse(text.replace(/```json|```/g, '').trim());

async function callGemini(system, payload, { maxTokens, model }) {
  const base = process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com';
  const res = await fetch(`${base}/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: JSON.stringify(payload) }] }],
      generationConfig: {
        responseMimeType: 'application/json', maxOutputTokens: maxTokens, temperature: 0.2,
        // Los modelos 2.5 "piensan" dentro del límite de salida y podrían truncar el JSON; los flash permiten desactivarlo.
        ...(/flash/.test(model) ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
      },
    }),
    signal: AbortSignal.timeout(120000),
  });
  if (!res.ok) { const e = new Error(`Gemini API ${res.status}: ${(await res.text()).slice(0, 300)}`); e.status = res.status; throw e; }
  const data = await res.json();
  const text = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
  if (!text) throw new Error(`Gemini sin contenido (${data.candidates?.[0]?.finishReason || data.promptFeedback?.blockReason || 'desconocido'})`);
  return parseJSON(text);
}

async function callAnthropic(system, payload, { maxTokens, model }) {
  const base = process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com';
  const res = await fetch(`${base}/v1/messages`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model, max_tokens: maxTokens, system, messages: [{ role: 'user', content: JSON.stringify(payload) }] }),
    signal: AbortSignal.timeout(120000),
  });
  if (!res.ok) { const e = new Error(`Anthropic API ${res.status}: ${(await res.text()).slice(0, 300)}`); e.status = res.status; throw e; }
  const data = await res.json();
  return parseJSON(data.content.filter((b) => b.type === 'text').map((b) => b.text).join(''));
}

/** Llama al modelo con un prompt de sistema y una carga JSON; devuelve el JSON de la respuesta. Reintenta ante límites de uso. */
export async function llmJSON(system, payload, { maxTokens = 8000, model = MODEL } = {}) {
  const call = PROVIDER === 'gemini' ? callGemini : callAnthropic;
  for (let attempt = 0; ; attempt++) {
    try { return await call(system, payload, { maxTokens, model }); }
    catch (err) {
      const retryable = [429, 500, 503].includes(err.status);
      if (!retryable || attempt >= 3) throw err;
      await sleep(15000 * (attempt + 1)); // la capa gratuita de Gemini limita las peticiones por minuto
    }
  }
}
const callClaude = (items) => llmJSON(SYSTEM, items);

/**
 * Enriquece planes de fuentes externas. Usa caché por contenido: un evento que no cambia
 * no se vuelve a enviar nunca. Si no hay clave de API, devuelve los planes tal cual.
 */
export async function enrich(plans, log = console.log) {
  if (!aiEnabled()) { log('IA desactivada (sin GEMINI_API_KEY ni ANTHROPIC_API_KEY): se usan reglas y texto original.'); return plans; }
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
