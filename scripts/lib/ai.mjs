import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { ROOT, TOPIC_IDS, hash, addDays, todayISO } from './util.mjs';

// Proveedor de IA: Gemini si hay GEMINI_API_KEY; si no, Anthropic si hay ANTHROPIC_API_KEY.
const PROVIDER = process.env.GEMINI_API_KEY ? 'gemini' : process.env.ANTHROPIC_API_KEY ? 'anthropic' : null;
export const MODEL = process.env.SINPLANES_MODEL || (PROVIDER === 'anthropic' ? 'claude-haiku-5-5' : 'gemini-2.5-flash-lite');
const MAX_ITEMS = Number(process.env.SINPLANES_MAX_AI_ITEMS || 100); // tope de coste por ejecución
const BATCH = 25;

// Presupuesto por ejecución: la IA nunca puede alargar el job ni agotar la cuota.
const RPM = Number(process.env.SINPLANES_AI_RPM || 8);                  // peticiones por minuto (la capa gratuita permite 10-15)
const MAX_CALLS = Number(process.env.SINPLANES_MAX_AI_CALLS || 30);     // peticiones por ejecución
const DEADLINE_MS = Number(process.env.SINPLANES_AI_MINUTES || 8) * 60000; // tiempo máximo dedicado a la IA
const started = Date.now();
let calls = 0;
let lastCall = 0;
let tripped = false; // cortacircuitos: tras un 429 persistente no se vuelve a llamar en esta ejecución

export const aiEnabled = () => PROVIDER !== null && !tripped;
export const budgetError = (err) => Boolean(err?.budget);
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

function budget(msg) { const e = new Error(msg); e.budget = true; return e; }

/** Espera indicada por Google en un 429 ("retryDelay": "23s"), acotada. */
const retryDelayMs = (err) => Math.min(60000, ((Number((err.message.match(/"retryDelay":\s*"(\d+)/) || [])[1]) || 20) + 2) * 1000);

/**
 * Llama al modelo con un prompt de sistema y una carga JSON; devuelve el JSON de la respuesta.
 * Respeta RPM, tope de llamadas y de tiempo. Un 429 se reintenta una vez; si persiste, se asume cuota
 * agotada y se corta la IA en lo que queda de ejecución (error con .budget = true).
 */
export async function llmJSON(system, payload, { maxTokens = 8000, model = MODEL } = {}) {
  const call = PROVIDER === 'gemini' ? callGemini : callAnthropic;
  for (let attempt = 0; ; attempt++) {
    if (tripped) throw budget('IA desactivada en esta ejecución (cuota agotada)');
    if (calls >= MAX_CALLS) throw budget(`tope de ${MAX_CALLS} peticiones por ejecución alcanzado`);
    if (Date.now() - started > DEADLINE_MS) throw budget('tiempo máximo de IA agotado');
    const wait = lastCall + 60000 / RPM - Date.now();
    if (wait > 0) await sleep(wait);
    calls++; lastCall = Date.now();
    try { return await call(system, payload, { maxTokens, model }); }
    catch (err) {
      if (err.status === 429) {
        if (attempt >= 1) { tripped = true; throw budget(`límite de uso de la API (429) persistente: ${err.message}`); }
        await sleep(retryDelayMs(err));
      } else if ([500, 503].includes(err.status) && attempt < 2) {
        await sleep(10000);
      } else throw err;
    }
  }
}

export const aiStats = () => ({ calls, seconds: Math.round((Date.now() - started) / 1000), tripped });
const callClaude = (items) => llmJSON(SYSTEM, items);

/**
 * Enriquece planes de fuentes externas. Usa caché por contenido: un evento que no cambia
 * no se vuelve a enviar nunca. Si no hay clave de API, devuelve los planes tal cual.
 */
export async function enrich(plans, log = console.log) {
  if (!aiEnabled()) { log('IA desactivada (sin GEMINI_API_KEY ni ANTHROPIC_API_KEY): se usan reglas y texto original.'); return plans; }
  const cache = loadCache();
  const keyOf = (p) => hash(`${p.title.es}|${p.rawText}`);
  // Solo se reescribe lo que ocurre pronto: el resto sigue con reglas y texto original hasta que se acerque su fecha.
  const soon = addDays(todayISO(), 21);
  const pending = plans.filter((p) => !p.title.en && !cache[keyOf(p)] && (p.start || '') <= soon).slice(0, MAX_ITEMS);
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
      if (budgetError(err)) break;
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
