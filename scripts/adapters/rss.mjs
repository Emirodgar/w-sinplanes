import { getText, stripHtml, addDays, todayISO } from '../lib/util.mjs';
import { parseFeed, feedDay } from '../lib/xml.mjs';

// Palabras que delatan un contenido de agenda. Las secciones de cultura y ocio de la prensa mezclan
// agenda con críticas y obituarios; este filtro barato evita mandar a la IA lo que claramente no es un plan.
const AGENDA = /concierto|festival|\bferia\b|\bfiestas?\b|romer[ií]a|exposici[oó]n|muestra|estren|inaugura|teatro|\bcine\b|ciclo|jornadas|mercad|\bruta\b|carrera|marat[oó]n|torneo|procesi[oó]n|desfile|cabalgata|verbena|certamen|presentaci[oó]n|programaci[oó]n|agenda|este (?:s[aá]bado|domingo|viernes|fin de semana)|d[ií]a \d|del \d+ al \d+|\d{1,2} de (?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)|entradas/i;

/**
 * Feed de prensa → candidatos a plan. NO devuelve eventos: devuelve titulares con texto que la
 * extracción por IA (lib/extract.mjs) convertirá en eventos o descartará.
 */
export default async function rss(src) {
  const xml = await getText(src.url);
  const items = parseFeed(xml);
  if (!items.length) throw new Error('el feed no contiene elementos (¿ha cambiado la URL?)');
  const today = todayISO();
  const newest = items.map((i) => feedDay(i.published)).filter(Boolean).sort().at(-1);
  if (newest && newest < addDays(today, -30)) throw new Error(`feed obsoleto: lo último es del ${newest}`);
  const since = addDays(today, -(src.dias || 3));
  const out = [];
  for (const it of items) {
    const day = feedDay(it.published);
    if (!it.title || !it.link || (day && day < since)) continue;
    const body = stripHtml(`${it.description} ${it.content}`).slice(0, 1500);
    if (!src.sin_filtro && !AGENDA.test(`${it.title} ${body}`)) continue;
    out.push({ _candidate: true, title: it.title.trim(), text: body, url: it.link.trim(), published: day, lang: 'es' });
  }
  return out;
}
