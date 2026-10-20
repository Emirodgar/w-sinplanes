import { readFileSync } from 'node:fs';
import path from 'node:path';
import { load as yamlLoad } from 'js-yaml';
import { ROOT } from './util.mjs';

const monthIndex = (ym) => { const [y, m] = ym.split('-').map(Number); return y * 12 + m - 1; };
const ymOf = (iso) => iso.slice(0, 7);

/**
 * Libros del sitio para una fecha (ISO):
 *   actual:    1) un destacado con la ventana activa (gana el primero de la lista); 2) si no, el de la reserva que
 *              toca este mes (uno por mes, desde `inicio`, sin repetir hasta recorrer la lista).
 *   historico: todo lo recomendado desde `inicio` hasta hoy, lo más reciente primero. Cada mes cuenta como
 *              recomendación de la reserva salvo que un destacado ocupe ese mes.
 *   generos:   etiquetas para filtrar.
 */
export function buildBooks(today) {
  const cfg = yamlLoad(readFileSync(path.join(ROOT, 'config/libros.yml'), 'utf8')) || {};
  const destacados = cfg.destacados || [];
  const reserva = cfg.reserva || [];
  const inicio = cfg.inicio || ymOf(today);
  const nowM = monthIndex(ymOf(today));
  const startM = monthIndex(inicio);

  const reservaDe = (mi) => reserva[((mi - startM) % reserva.length + reserva.length) % reserva.length];
  const withMonth = (b, ym, origen) => ({ ...b, mes: ym, origen });

  const active = destacados.find((b) => b.desde <= today && today <= b.hasta);
  const actual = active
    ? withMonth(active, ymOf(today), 'destacado')
    : reserva.length ? withMonth(reservaDe(nowM), ymOf(today), 'reserva') : null;

  // Histórico: los destacados ya empezados y, cada mes sin destacado, la reserva.
  const history = [];
  const busy = new Set();
  for (const b of destacados) {
    if (b.desde > today) continue;
    history.push({ ...b, mes: ymOf(b.desde), orden: b.desde, origen: 'destacado' });
    for (let mi = monthIndex(ymOf(b.desde)); mi <= monthIndex(ymOf(b.hasta)); mi++) busy.add(mi);
  }
  if (reserva.length) {
    for (let mi = startM; mi <= nowM; mi++) {
      if (busy.has(mi)) continue;
      const y = Math.floor(mi / 12), m = (mi % 12) + 1;
      const ym = `${y}-${String(m).padStart(2, '0')}`;
      history.push({ ...reservaDe(mi), mes: ym, orden: `${ym}-01`, origen: 'reserva' });
    }
  }
  // Un libro que repite (reserva tras recorrer la lista) sale una vez, con su recomendación más reciente.
  history.sort((a, b) => b.orden.localeCompare(a.orden));
  const seen = new Set();
  const historico = history.filter((b) => !seen.has(b.id) && seen.add(b.id)).map(({ orden, ...b }) => b);

  return { actual, historico, generos: cfg.generos || {} };
}
