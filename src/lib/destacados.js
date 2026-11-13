// Días señalados que se destacan en la portada. Cada uno es un plan de config/seasonal.yml (citas) que ya
// existe con sus fechas reales; aquí solo se elige cuáles merecen tarjeta y con cuántos días de antelación.
// La ventana se calcula con la fecha del build; la cuenta atrás la corrige el navegador con la fecha real en Madrid.
import { TODAY, plans, hasText } from './data.js';

export const DESTACADOS = [
  { slug: 'encendido-luces', antes: 10 },
  { slug: 'loteria-navidad', antes: 10 },
  { slug: 'campanadas', antes: 7 },
  { slug: 'cabalgata-reyes', antes: 7 },
  { slug: 'goya', antes: 7 },
  { slug: 'super-bowl', antes: 5 },
  { slug: 'oscars', antes: 7 },
  { slug: 'semana-santa', antes: 14 },
  { slug: 'sant-jordi', antes: 7 },
  { slug: 'eurovision', antes: 7 },
  { slug: 'final-champions', antes: 5 },
  { slug: 'san-juan', antes: 7 },
  { slug: 'premio-planeta', antes: 5 },
];

const days = (a, b) => Math.round((new Date(b + 'T12:00:00Z') - new Date(a + 'T12:00:00Z')) / 864e5);

/** El día señalado que toca mostrar hoy (el más cercano si coinciden varios), con los días que faltan; o null. */
export function diaDestacado(lang) {
  const found = [];
  for (const d of DESTACADOS) {
    const p = plans.find((x) => x.slug === d.slug);
    if (!p || !p.start || !hasText(p, lang)) continue;
    const end = p.end || p.start;
    const left = days(TODAY, p.start);
    if (end >= TODAY && left <= d.antes) found.push({ p, left });
  }
  found.sort((a, b) => a.left - b.left);
  return found[0] || null;
}
