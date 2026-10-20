import { TODAY, isPlace } from './data.js';

/**
 * Enlaces para añadir un plan al calendario (adaptado del desarrollo de Open Salamanca).
 * - Planes con fecha: la fecha del plan (con hora si la tiene).
 * - Planes de temporada (meses): desde hoy si ya estamos en temporada; si no, el día 1 del próximo mes de la lista.
 * - Lugares fijos (museos, parques…): sin fecha, no hay nada que añadir.
 */

const pad = (n) => String(n).padStart(2, '0');
const digits = (iso) => iso.replace(/-/g, '');
const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const lastDayOf = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate(); // m = 1..12

/** Fechas del plan: { start, end (inclusivo), time? } o null si no procede. */
export function calendarDates(p) {
  if (isPlace(p)) return null;
  if (p.kind !== 'estacional') {
    if (!p.start) return null;
    return { start: p.start, end: p.end || p.start, time: p.time || null };
  }
  const months = [...(p.months || [])].sort((a, b) => a - b);
  if (!months.length) return null;
  const year = Number(TODAY.slice(0, 4));
  const cur = Number(TODAY.slice(5, 7));
  // Próximo mes de temporada (este mismo, si ya estamos en él; si no, el siguiente, saltando de año si hace falta)
  const m = months.includes(cur) ? cur : (months.find((x) => x > cur) ?? months[0]);
  const y = m >= cur ? year : year + 1;
  const start = m === cur && y === year ? TODAY : `${y}-${pad(m)}-01`;
  // Fin: último día del tramo de meses consecutivos que empieza en m
  let endM = m, endY = y;
  for (let i = 0; i < 11; i++) {
    const next = endM === 12 ? 1 : endM + 1;
    if (!months.includes(next)) break;
    if (endM === 12) endY += 1;
    endM = next;
  }
  return { start, end: `${endY}-${pad(endM)}-${pad(lastDayOf(endY, endM))}`, time: null };
}

const TZ = 'Europe/Madrid';
const DEFAULT_HOURS = 2; // duración supuesta de un plan con hora de inicio pero sin hora de fin

function span(d) {
  if (!d.time) {
    // Todo el día: DTEND es exclusivo en iCalendar, Google y Outlook
    return { allDay: true, from: digits(d.start), to: digits(addDays(d.end, 1)) };
  }
  const [h, mi] = d.time.split(':').map(Number);
  const endH = h + DEFAULT_HOURS;
  const sameDay = d.end === d.start;
  // Con hora y varios días, el evento acaba a las 23:59 del último día
  const to = sameDay && endH < 24 ? `${digits(d.end)}T${pad(endH)}${pad(mi)}00` : `${digits(d.end)}T235900`;
  return { allDay: false, from: `${digits(d.start)}T${pad(h)}${pad(mi)}00`, to };
}

const ics = (s) => (s || '').replace(/\\/g, '\\\\').replace(/([,;])/g, '\\$1').replace(/\r?\n/g, '\\n');

/** { google, outlook, ics, filename } o null. `text` ya viene en el idioma de la página. */
export function calendarLinks(p, { title, description, location, pageUrl }) {
  const d = calendarDates(p);
  if (!d) return null;
  const s = span(d);
  const details = [description, pageUrl].filter(Boolean).join('\n\n');

  const g = new URLSearchParams({ action: 'TEMPLATE', text: title, dates: `${s.from}/${s.to}`, details, location: location || '' });
  if (!s.allDay) g.set('ctz', TZ);

  const o = new URLSearchParams({ path: '/calendar/action/compose', rru: 'addevent', subject: title, body: details, location: location || '' });
  if (s.allDay) {
    o.set('allday', 'true'); o.set('startdt', d.start); o.set('enddt', d.end);
  } else {
    const iso = (x) => `${x.slice(0, 4)}-${x.slice(4, 6)}-${x.slice(6, 8)}T${x.slice(9, 11)}:${x.slice(11, 13)}:00`;
    o.set('startdt', iso(s.from)); o.set('enddt', iso(s.to));
  }

  const slug = p.slug || 'plan';
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//sinplanes//Planes//ES', 'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${digits(d.start)}-${slug}@sinplanes.com`,
    `DTSTAMP:${digits(TODAY)}T000000Z`,
    s.allDay ? `DTSTART;VALUE=DATE:${s.from}` : `DTSTART;TZID=${TZ}:${s.from}`,
    s.allDay ? `DTEND;VALUE=DATE:${s.to}` : `DTEND;TZID=${TZ}:${s.to}`,
    `SUMMARY:${ics(title)}`,
    `DESCRIPTION:${ics(details)}`,
    ...(location ? [`LOCATION:${ics(location)}`] : []),
    ...(pageUrl ? [`URL:${pageUrl}`] : []),
    'END:VEVENT', 'END:VCALENDAR',
  ];
  // Zona horaria: los clientes de calendario conocen Europe/Madrid por su nombre; los .ics con hora incluyen VTIMEZONE por compatibilidad
  if (!s.allDay) lines.splice(4, 0, ...VTIMEZONE_MADRID);

  return {
    google: `https://calendar.google.com/calendar/render?${g}`,
    outlook: `https://outlook.live.com/calendar/0/deeplink/compose?${o}`,
    ics: 'data:text/calendar;charset=utf-8,' + encodeURIComponent(lines.join('\r\n')),
    filename: `${slug}.ics`,
  };
}

const VTIMEZONE_MADRID = [
  'BEGIN:VTIMEZONE', `TZID:${TZ}`,
  'BEGIN:STANDARD', 'DTSTART:19701025T030000', 'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU', 'TZOFFSETFROM:+0200', 'TZOFFSETTO:+0100', 'TZNAME:CET', 'END:STANDARD',
  'BEGIN:DAYLIGHT', 'DTSTART:19700329T020000', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU', 'TZOFFSETFROM:+0100', 'TZOFFSETTO:+0200', 'TZNAME:CEST', 'END:DAYLIGHT',
  'END:VTIMEZONE',
];
