import { readFileSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { load as yamlLoad } from 'js-yaml';
import { ROOT, addDays, resolveProvince } from './util.mjs';

const iso = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

/** Domingo de Resurrección (algoritmo anónimo gregoriano). */
export function easter(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return iso(y, month, day);
}

/** n-ésimo día de la semana de un mes (n = -1 → el último). */
export function nthWeekday(y, month, weekday, n) {
  if (n > 0) {
    const first = new Date(Date.UTC(y, month - 1, 1)).getUTCDay();
    return iso(y, month, 1 + ((weekday - first + 7) % 7) + (n - 1) * 7);
  }
  const lastDay = new Date(Date.UTC(y, month, 0)).getUTCDate();
  const lastDow = new Date(Date.UTC(y, month - 1, lastDay)).getUTCDay();
  return iso(y, month, lastDay - ((lastDow - weekday + 7) % 7));
}

function occurrence(regla, y) {
  switch (regla.tipo) {
    case 'fija': {
      const start = `${y}-${regla.inicio}`;
      let end = regla.fin ? `${y}-${regla.fin}` : start;
      if (end < start) end = `${y + 1}-${regla.fin}`;
      return { start, end };
    }
    case 'pascua': {
      const e = easter(y);
      return { start: addDays(e, regla.desde), end: addDays(e, regla.hasta ?? regla.desde) };
    }
    case 'enesimo': {
      const start = nthWeekday(y, regla.mes, regla.dia_semana, regla.n);
      return { start, end: addDays(start, (regla.dura || 1) - 1) };
    }
    default:
      throw new Error(`Regla de fecha desconocida: ${regla.tipo}`);
  }
}

/** Próxima edición (o la actual si está en curso) a partir de hoy. */
export function nextOccurrence(regla, today) {
  const y = Number(today.slice(0, 4));
  for (const year of [y - 1, y, y + 1]) {
    const o = occurrence(regla, year);
    if (o.end >= today) return o;
  }
  return occurrence(regla, y + 1);
}

// Cada grupo de lugares.yml cuelga de un tema propio (con página propia): se suma a los temas que ya tenga la ficha.
const GROUP_TOPIC = { lugares: 'museos', rutas: 'rutas', naturaleza: 'parques', actividades: 'actividades' };
const parkType = (title) => (/^Parque Nacional/i.test(title) ? 'nacional' : /^Parque Natural/i.test(title) ? 'natural' : /^Reserva de la Biosfera/i.test(title) ? 'biosfera' : 'otros');

/** Lugares fijos de config/lugares.yml, de todos los grupos y con su enlace a la fuente (lo usan el esqueleto y check-skeleton). */
export function readLugares() {
  const doc = yamlLoad(readFileSync(path.join(ROOT, 'config/lugares.yml'), 'utf8')) || {};
  return Object.keys(doc.bases || {}).flatMap((g) => (doc[g] || []).map((l) => ({ ...l, grupo: g, fuente: doc.bases[g] + l.id + '/' })));
}

/** Fichas ampliadas de los lugares fijos (texto, imagen y preguntas frecuentes), por id, en config/fichas-lugares.yml. Opcional. */
export function readFichasLugares() {
  const file = path.join(ROOT, 'config/fichas-lugares.yml');
  return existsSync(file) ? yamlLoad(readFileSync(file, 'utf8')) || {} : {};
}

/** Fichas ampliadas traducidas: <carpeta>/<idioma>.yml (config/traducciones para el calendario, config/traducciones-lugares para los lugares fijos), por id de plan, con la misma forma que `contenido.es`. */
export function readContentTranslations(folder = 'config/traducciones') {
  const dir = path.join(ROOT, folder);
  if (!existsSync(dir)) return {};
  const out = {};
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.yml'))) {
    out[f.slice(0, -4)] = yamlLoad(readFileSync(path.join(dir, f), 'utf8')) || {};
  }
  return out;
}

/** Une `contenido` (castellano) con las fichas traducidas del plan; nada si no hay ninguna. */
function contentOf(item, i18n) {
  const content = { ...(item.contenido || {}) };
  for (const [lang, byId] of Object.entries(i18n)) if (byId[item.id]) content[lang] = byId[item.id];
  return Object.keys(content).length ? { content } : {};
}

function placeOf(lugar) {
  if (!lugar) return { scope: 'nacional' };
  const p = resolveProvince(lugar.provincia);
  return { scope: 'local', provincia: p?.provincia || lugar.provincia, ccaa: p?.ccaa || null, municipio: lugar.municipio || null };
}

export function buildSeasonalPlans(today) {
  const doc = yamlLoad(readFileSync(path.join(ROOT, 'config/seasonal.yml'), 'utf8'));
  const plans = [];
  const i18n = readContentTranslations();

  for (const t of doc.temporada || []) {
    plans.push({
      id: `t-${t.id}`, slug: t.id, kind: 'estacional',
      title: { es: t.es.titulo, en: t.en.titulo },
      summary: { es: t.es.resumen, en: t.en.resumen },
      months: t.meses, topics: t.temas,
      place: placeOf(t.lugar), source: { name: 'sinplanes', url: null },
      // Ficha ampliada (opcional): texto, imagen y preguntas frecuentes por idioma (es en este archivo; el resto en config/traducciones/).
      ...contentOf(t, i18n),
      ...(t.imagen ? { image: t.imagen, imageSize: t.imagen_tam || null } : {}),
      ...(t.relacionados ? { related: t.relacionados } : {}),
    });
  }

  for (const c of doc.citas || []) {
    const { start, end } = nextOccurrence(c.regla, today);
    // 'pantalla' si el plan es para verlo (primer tema), 'evento' si hay que ir
    const kind = c.temas[0] === 'pantalla' ? 'pantalla' : 'evento';
    plans.push({
      id: `c-${c.id}`, slug: c.id, kind, recurring: true, approx: !!c.aprox,
      title: { es: c.es.titulo, en: c.en.titulo },
      summary: { es: c.es.resumen, en: c.en.resumen },
      start, end, topics: c.temas,
      place: placeOf(c.lugar), source: { name: 'sinplanes', url: c.fuente || null },
      ...contentOf(c, i18n),
      ...(c.imagen ? { image: c.imagen, imageSize: c.imagen_tam || null } : {}),
      ...(c.relacionados ? { related: c.relacionados } : {}),
    });
  }

  // Lugares fijos (museos, parques, rutas…): sin fecha, abiertos todo el año. Ver config/lugares.yml.
  const fichas = readFichasLugares();
  const i18nLugares = readContentTranslations('config/traducciones-lugares');
  for (const l of readLugares()) {
    const f = fichas[l.id];
    plans.push({
      id: `l-${l.id}`, slug: l.id, kind: 'lugar', group: l.grupo,
      title: { es: l.es[0], en: l.en[0] },
      summary: { es: l.es[1], en: l.en[1] },
      months: [], topics: [...l.temas, ...(GROUP_TOPIC[l.grupo] ? [GROUP_TOPIC[l.grupo]] : [])], ...(l.grupo === 'naturaleza' ? { parkType: parkType(l.es[0]) } : {}),
      place: placeOf(l.lugar ? { provincia: l.lugar[0], municipio: l.lugar[1] } : null), source: { name: 'sinplanes', url: l.fuente },
      ...contentOf({ id: l.id, contenido: f?.contenido }, i18nLugares),
      ...(f?.imagen ? { image: f.imagen, imageSize: f.imagen_tam || null } : {}),
      ...(f?.relacionados ? { related: f.relacionados } : {}),
    });
  }
  return plans;
}
