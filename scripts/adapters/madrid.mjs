import { getJSON, pick, toDay, toTime, stripHtml } from '../lib/util.mjs';

// Agenda del Ayuntamiento de Madrid (JSON-LD con @graph)
export default async function madrid(src) {
  const data = await getJSON(src.url);
  const items = data['@graph'] || data.graph || [];
  return items.map((e) => ({
    title: e.title,
    description: stripHtml(e.description || ''),
    start: toDay(e.dtstart),
    end: toDay(e.dtend) || toDay(e.dtstart),
    time: toTime(e.dtstart),
    url: e.link || e['@id'],
    venue: e['event-location'] || null,
    municipio: pick(e, ['address.area.locality']) || 'Madrid',
    provincia: 'Madrid',
    lat: Number(pick(e, ['location.latitude'])) || null,
    lon: Number(pick(e, ['location.longitude'])) || null,
    free: e.free === 1 || e.free === '1' || e.free === true,
    price: stripHtml(e.price || '') || null,
    hints: [e['@type'], e.audience].filter(Boolean).map(String),
    lang: 'es',
  }));
}
