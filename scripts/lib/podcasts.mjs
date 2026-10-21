import { readFileSync } from 'node:fs';
import path from 'node:path';
import { load as yamlLoad } from 'js-yaml';
import { ROOT } from './util.mjs';

const DAY = 864e5;
const dayNum = (iso) => Math.floor(Date.parse(iso.slice(0, 10)) / DAY);
// Las semanas empiezan en lunes: el 1-1-1970 fue jueves, de ahí el +3.
const weekIndex = (iso) => Math.floor((dayNum(iso) + 3) / 7);
const weekStart = (wi) => new Date((wi * 7 - 3) * DAY).toISOString().slice(0, 10);

/**
 * Podcasts del sitio para una fecha (ISO), con el mismo esquema que los libros pero por semanas (lunes a domingo):
 *   actual:    1) un destacado con la ventana activa (gana el primero de la lista); 2) si no, el de la reserva que
 *              toca esta semana (uno por semana, desde `inicio`, sin repetir hasta recorrer la lista).
 *   historico: todo lo recomendado desde `inicio` hasta hoy, lo más reciente primero. Cada semana cuenta como
 *              recomendación de la reserva salvo que un destacado ocupe esa semana.
 *   generos:   etiquetas para filtrar.
 * Cada elemento lleva `semana` (lunes de la semana en que se recomendó, ISO).
 */
export function buildPodcasts(today, cfgPath = path.join(ROOT, 'config/podcasts.yml')) {
  const cfg = yamlLoad(readFileSync(cfgPath, 'utf8')) || {};
  const destacados = cfg.destacados || [];
  const reserva = cfg.reserva || [];
  const nowW = weekIndex(today);
  const startW = cfg.inicio ? weekIndex(cfg.inicio) : nowW;

  const reservaDe = (wi) => reserva[((wi - startW) % reserva.length + reserva.length) % reserva.length];
  const withWeek = (p, wi, origen) => ({ ...p, semana: weekStart(wi), origen });

  const active = destacados.find((p) => p.desde <= today && today <= p.hasta);
  const actual = active
    ? withWeek(active, nowW, 'destacado')
    : reserva.length ? withWeek(reservaDe(nowW), nowW, 'reserva') : null;

  const history = [];
  const busy = new Set();
  for (const p of destacados) {
    if (p.desde > today) continue;
    history.push({ ...p, semana: weekStart(weekIndex(p.desde)), origen: 'destacado' });
    for (let wi = weekIndex(p.desde); wi <= weekIndex(p.hasta); wi++) busy.add(wi);
  }
  if (reserva.length) {
    for (let wi = startW; wi <= nowW; wi++) {
      if (busy.has(wi)) continue;
      history.push({ ...reservaDe(wi), semana: weekStart(wi), origen: 'reserva' });
    }
    // Recomendaciones anteriores al arranque de la rotación: entran en el histórico con su fecha real.
    for (const p of reserva) {
      if (p.fecha && weekIndex(p.fecha) < startW) history.push({ ...p, semana: weekStart(weekIndex(p.fecha)), origen: 'archivo' });
    }
  }
  // Un podcast que repite (reserva tras recorrer la lista) sale una vez, con su recomendación más reciente.
  history.sort((a, b) => b.semana.localeCompare(a.semana));
  const seen = new Set();
  const historico = history.filter((p) => !seen.has(p.id) && seen.add(p.id));

  return { actual, historico, generos: cfg.generos || {} };
}
