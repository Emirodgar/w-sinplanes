import { getText, toDay, toTime, stripHtml } from '../lib/util.mjs';

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
    const [lat, lon] = (e.GEO || '').split(';').map(Number);
    return {
      title: e.SUMMARY,
      description: stripHtml(e.DESCRIPTION || ''),
      start: toDay(e.DTSTART),
      end: toDay(e.DTEND) || toDay(e.DTSTART),
      time: toTime(e.DTSTART),
      url: absUrl(e.URL, src.url),
      venue: e.LOCATION || null,
      municipio: src.municipio || null,
      provincia: src.provincia || null,
      lat: lat || null, lon: lon || null,
      free: /gratu|de balde|libre/i.test(e.DESCRIPTION || ''),
      price: null,
      hints: [e.CATEGORIES].filter(Boolean),
      lang: src.idioma || 'es',
    };
  });
}
