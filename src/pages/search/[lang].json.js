// Índice de búsqueda por idioma (se carga solo cuando alguien escribe en el buscador de la portada).
import { LANGS, url, t } from '../../i18n/ui.js';
import { plans, isPast, hasText, ptitle, fmtWhen, fmtPlace, topicById } from '../../lib/data.js';

export function getStaticPaths() {
  return LANGS.map((lang) => ({ params: { lang } }));
}

export function GET({ params }) {
  const lang = params.lang;
  const L = t[lang];
  const items = plans
    .filter((p) => hasText(p, lang) && !isPast(p))
    .map((p) => ({
      t: ptitle(p, lang),
      u: url.plan(lang, p.slug),
      w: fmtWhen(lang, p),
      p: fmtPlace(p, L.allSpain),
      k: (p.topics || []).map((id) => topicById(id)?.[lang]).filter(Boolean).join(' '),
      ...(p.free ? { f: 1 } : {}),
    }));
  return new Response(JSON.stringify(items), { headers: { 'Content-Type': 'application/json' } });
}
