// Enumera todas las páginas (el esqueleto sale solo de config; los eventos solo añaden páginas de plan) del sitio en todos los idiomas a partir de rutas neutras al idioma.
import { LANGS, routeUrl } from '../i18n/ui.js';
import curiosidades from '../../data/curiosidades.json';
import { plans, topics, geo, byCcaa, byProvince, slugify, hasText } from './data.js';

function specs() {
  const out = [{ type: 'home' }, { type: 'topics' }, { type: 'places' }, { type: 'calendar' }, { type: 'museums' }, { type: 'routes' }, { type: 'parks' }, { type: 'books' }, { type: 'series' }, { type: 'movies' }, { type: 'podcasts' }, { type: 'races' }, { type: 'sports' }, { type: 'curiosities' }];
  for (const c of curiosidades.todas) out.push({ type: 'curiosity', id: c.id, item: c });
  for (const p of plans) out.push({ type: 'plan', slug: p.slug, plan: p });
  for (const tp of topics) if (!tp.page) out.push({ type: 'topic', tp }); // museos, rutas y parques tienen página propia
  for (const c of geo) {
    out.push({ type: 'ccaa', c: c.slug, geo: c });
    for (const prov of c.provincias) {
      const s = slugify(prov);
      out.push({ type: 'province', c: c.slug, s, geo: c, prov }); // fijas: existan o no eventos (noindex mientras tengan <3 planes)
    }
  }
  for (let m = 1; m <= 12; m++) out.push({ type: 'month', m });
  return out;
}

export function getAllPaths() {
  const all = specs();
  const paths = [];
  for (const lang of LANGS) {
    for (const r of all) {
      if (r.type === 'plan' && !hasText(r.plan, lang)) continue;
      const route = routeUrl(lang, r).replace(/^\/|\/$/g, '');
      paths.push({ params: { route: route || undefined }, props: { lang, r } });
    }
  }
  return paths;
}

export { byCcaa };
