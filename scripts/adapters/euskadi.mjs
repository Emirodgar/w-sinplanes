import { getJSON, pick, toDay, toTime, stripHtml } from '../lib/util.mjs';

// API de agenda cultural de Open Data Euskadi (Kulturklik). Paginada con _page/_elements.
export default async function euskadi(src) {
  const out = [];
  for (let page = 1; page <= (src.paginas || 10); page++) {
    const data = await getJSON(`${src.url}?_elements=50&_page=${page}`);
    const items = data.items || [];
    for (const e of items) {
      out.push({
        title: pick(e, ['nameEs', 'name', 'nameEu']),
        description: stripHtml(pick(e, ['descriptionEs', 'description', 'descriptionEu']) || ''),
        start: toDay(pick(e, ['startDate', 'start'])),
        end: toDay(pick(e, ['endDate', 'end', 'startDate'])),
        time: toTime(pick(e, ['openingHoursEs', 'startDate'])),
        url: pick(e, ['urlEventEs', 'sourceUrlEs', 'urlEventEu', 'url']),
        venue: pick(e, ['establishmentEs', 'establishment']),
        municipio: pick(e, ['municipalityEs', 'municipality']),
        provincia: pick(e, ['provinceEs', 'province', 'territoryEs']),
        lat: Number(pick(e, ['municipalityLatitude', 'latitude'])) || null,
        lon: Number(pick(e, ['municipalityLongitude', 'longitude'])) || null,
        free: /gratu|doan/i.test(String(pick(e, ['priceEs', 'price']) || '')),
        price: stripHtml(String(pick(e, ['priceEs', 'price']) || '')) || null,
        hints: [pick(e, ['typeEs', 'type'])].filter(Boolean).map(String),
        lang: 'es',
      });
    }
    if (!items.length || page >= (data.totalPages || page)) break;
  }
  return out;
}
