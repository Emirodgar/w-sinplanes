import { readFileSync } from 'node:fs';
import path from 'node:path';
import { load as yamlLoad } from 'js-yaml';
import { ROOT } from './util.mjs';

/**
 * Libro recomendado para una fecha (ISO).
 * 1) un destacado cuya ventana esté activa (gana el primero de la lista);
 * 2) si no hay, uno de la reserva: se rota por mes y es estable durante todo el mes.
 */
export function pickBook(today) {
  const cfg = yamlLoad(readFileSync(path.join(ROOT, 'config/libros.yml'), 'utf8')) || {};
  const destacados = cfg.destacados || [];
  const reserva = cfg.reserva || [];
  const active = destacados.find((b) => b.desde <= today && today <= b.hasta);
  if (active) return { ...active, origen: 'destacado' };
  if (!reserva.length) return null;
  const [y, m] = today.split('-').map(Number);
  return { ...reserva[(y * 12 + m) % reserva.length], origen: 'reserva' };
}
