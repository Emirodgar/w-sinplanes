import { getText, toDay, toTime, stripHtml } from '../lib/util.mjs';

// Algunas agendas (A Coruña) meten una ficha HTML entera en DESCRIPTION: la descripción real va en <p class="entradilla">
// y las coordenadas en <meta property="latitude|longitude">. El resto (fechas, inscripción, scripts) sobra.
function fromHtmlCard(html = '') {
  const lead = html.match(/<p[^>]*class=["']entradilla["'][^>]*>([\s\S]*?)<\/p>/i);
  const note = html.match(/<p[^>]*class=["']notaFechaInscripcion["'][^>]*>([\s\S]*?)<\/p>\s*<\/section>/i);
  const lat = html.match(/property=["']latitude["']\s+content=["']([^"']+)/i);
  const lon = html.match(/property=["']longitude["']\s+content=["']([^"']+)/i);
  const text = lead ? stripHtml(lead[1]) : stripHtml(html);
  return { text: [text, note ? stripHtml(note[1]) : ''].filter(Boolean).join(' '), lat: lat ? Number(lat[1]) : null, lon: lon ? Number(lon[1]) : null };
}

// Lector iCal mínimo (VEVENT). Sirve para cualquier ayuntamiento que publique agenda .ics.
export function parseICS(text) {
  const lines = text.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '').split(/\r?\n/);
  const events = [];
  let cur = null;
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') cur = {};
    else if (line === 'END:VEVENT') { if (cur) events.push(cur); cur = null; }
    else if (cur) {
      const i = line.indexOf(':');
      if (i < 0) continue;
      const key = line.slice(0, i).split(';')[0].toUpperCase();
      cur[key] = line.slice(i + 1).replace(/\\n/g, ' ').replace(/\\,/g, ',').replace(/\\;/g, ';');
    }
  }
  return events;
}

// Algunos ayuntamientos (A Coruña) publican URLs relativas en el .ics.
function absUrl(u, base) {
  if (!u) return null;
  try { return new URL(u, base).href; } catch { return null; }
}

export default async function ical(src) {
  const events = parseICS(await getText(src.url));
  return events.map((e) => {
    const [glat, glon] = (e.GEO || '').split(';').map(Number);
    const card = /<(?:section|p|div)/i.test(e.DESCRIPTION || '') ? fromHtmlCard(e.DESCRIPTION) : { text: stripHtml(e.DESCRIPTION || ''), lat: null, lon: null };
    const lat = glat || card.lat;
    const lon = glon || card.lon;
    return {
      title: e.SUMMARY,
      description: card.text,
      start: toDay(e.DTSTART),
      end: toDay(e.DTEND) || toDay(e.DTSTART),
      time: toTime(e.DTSTART),
      url: absUrl(e.URL, src.url),
      venue: e.LOCATION || null,
      municipio: src.municipio || null,
      provincia: src.provincia || null,
      lat: lat || null, lon: lon || null,
      free: /gratu|de balde|libre/i.test(card.text),
      price: null,
      hints: [e.CATEGORIES].filter(Boolean),
      lang: src.idioma || 'es',
    };
  });
}
