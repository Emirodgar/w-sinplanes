import { getJSON, pick, toDay, toTime, stripHtml, todayISO } from '../lib/util.mjs';

// API Explore v2.1 de Opendatasoft (la usa, entre otros, la Junta de Castilla y León).
// Los nombres de campo varían entre portales: por eso se prueban varias claves.
export default async function opendatasoft(src) {
  const out = [];
  const limit = 100;
  for (let offset = 0; offset < (src.max || 1000); offset += limit) {
    const url = `${src.url}?limit=${limit}&offset=${offset}`;
    const data = await getJSON(url);
    const rows = data.results || [];
    for (const r of rows) {
      const start = toDay(pick(r, ['fecha_inicio', 'fecha_de_inicio', 'fechainicio', 'start_date', 'inicio']));
      const end = toDay(pick(r, ['fecha_fin', 'fecha_de_fin', 'fechafin', 'end_date', 'fin'])) || start;
      if (!start || end < todayISO()) continue;
      const geo = pick(r, ['posicion', 'geo_point_2d', 'coordenadas', 'localizacion']);
      out.push({
        title: pick(r, ['titulo', 'nombre', 'title', 'nombre_evento']),
        description: stripHtml(pick(r, ['descripcion', 'description', 'texto']) || ''),
        start, end,
        time: toTime(pick(r, ['hora_inicio', 'fecha_inicio'])),
        url: pick(r, ['enlace_contenido', 'enlace', 'url', 'link']),
        venue: pick(r, ['lugar_celebracion', 'lugar', 'nombre_lugar', 'espacio']),
        municipio: pick(r, ['nombre_localidad', 'localidad', 'municipio', 'nombre_municipio']),
        provincia: pick(r, ['nombre_provincia', 'provincia']) || src.provincia,
        lat: Number(geo?.lat ?? pick(r, ['latitud', 'latitude'])) || null,
        lon: Number(geo?.lon ?? pick(r, ['longitud', 'longitude'])) || null,
        free: /gratu|libre/i.test(String(pick(r, ['precio', 'price']) || '')),
        price: stripHtml(String(pick(r, ['precio', 'price']) || '')) || null,
        hints: [pick(r, ['categoria', 'tipo', 'tematica', 'publico'])].filter(Boolean).map(String),
        lang: 'es',
      });
    }
    if (rows.length < limit) break;
  }
  return out;
}
