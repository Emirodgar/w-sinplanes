// Temas de ocasión (de momento, solo Halloween). La ventana se calcula con la fecha del build; en el navegador
// la corrige el script de Base.astro con la fecha real en Madrid, por si el despliegue diario se retrasa.
import { TODAY, plans, isPast, isDated, hasText, isCourse, span, norm } from './data.js';

const year = Number(TODAY.slice(0, 4));
export const HALLOWEEN = { from: `${year}-10-24`, day: `${year}-10-31`, to: `${year}-11-01` };
export const isHalloween = TODAY >= HALLOWEEN.from && TODAY <= HALLOWEEN.to;

/** Días que faltan para el 31 de octubre (0 = hoy, negativo = ya pasó). */
export const halloweenDaysLeft = () => Math.round((new Date(HALLOWEEN.day + 'T12:00:00Z') - new Date(TODAY + 'T12:00:00Z')) / 864e5);

const RE = /halloween|terror|miedo|bruj[ao]|tenorio|calabaza|zombi|fantasma|monstruo|vampir|esqueleto|cine fant/;
const STRONG = /halloween|terror|miedo|bruj[ao]/;

/** Planes con fecha de estos días con aire de Halloween, sin repetir título, los más temáticos primero. */
export function halloweenPlans(lang, n = 6) {
  const seen = new Set();
  return plans
    .filter((p) => isDated(p) && !isPast(p) && hasText(p, lang) && !isCourse(p) && span(p) <= 14)
    .filter((p) => p.start <= HALLOWEEN.to && (p.end || p.start) >= TODAY)
    .filter((p) => !/cancelad/.test(norm(p.title?.es || '')) && RE.test(norm(`${p.title?.es || ''} ${p.summary?.es || ''}`)))
    .sort((a, b) => {
      const sa = STRONG.test(norm(a.title?.es || '')) ? 0 : 1;
      const sb = STRONG.test(norm(b.title?.es || '')) ? 0 : 1;
      return sa - sb || (a.start < TODAY ? TODAY : a.start).localeCompare(b.start < TODAY ? TODAY : b.start);
    })
    .filter((p) => { const k = norm(p.title?.es || ''); if (seen.has(k)) return false; seen.add(k); return true; })
    .slice(0, n);
}
