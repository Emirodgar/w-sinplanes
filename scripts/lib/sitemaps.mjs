// Integración de Astro: tras el build lee el HTML generado y escribe un sitemap por idioma con solo las páginas indexables (sin noindex).
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const LANGS = ['es', 'en', 'fr', 'de', 'it', 'pt'];
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function* htmlFiles(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* htmlFiles(p);
    else if (e.name.endsWith('.html')) yield p;
  }
}

const attr = (tag, name) => tag.match(new RegExp(`${name}="([^"]*)"`))?.[1];

function parse(html) {
  const links = [...html.matchAll(/<link\b[^>]*>/g)].map((m) => m[0]);
  const canonical = links.map((t) => (attr(t, 'rel') === 'canonical' ? attr(t, 'href') : null)).find(Boolean);
  const alternates = links.filter((t) => attr(t, 'rel') === 'alternate' && attr(t, 'hreflang')).map((t) => ({ hreflang: attr(t, 'hreflang'), href: attr(t, 'href') }));
  const noindex = [...html.matchAll(/<meta\b[^>]*>/g)].some((m) => attr(m[0], 'name') === 'robots' && /noindex/i.test(attr(m[0], 'content') || ''));
  return { canonical, alternates, noindex };
}

export function sitemaps({ site }) {
  return {
    name: 'sitemaps-por-idioma',
    hooks: {
      'astro:build:done': ({ dir, logger }) => {
        const out = fileURLToPath(dir);
        const pages = [];
        for (const file of htmlFiles(out)) {
          const rel = relative(out, file).split(sep);
          if (rel[0] === '404.html') continue;
          const { canonical, alternates, noindex } = parse(readFileSync(file, 'utf8'));
          if (!canonical || noindex) continue;
          pages.push({ loc: canonical, lang: LANGS.includes(rel[0]) ? rel[0] : 'es', alternates });
        }
        const ok = new Set(pages.map((p) => p.loc));
        const lastmod = new Date().toISOString().slice(0, 10);
        const written = [];
        for (const lang of LANGS) {
          const urls = pages.filter((p) => p.lang === lang).sort((a, b) => a.loc.localeCompare(b.loc));
          const body = urls.map((p) => {
            const alts = p.alternates.filter((a) => ok.has(a.href)).map((a) => `<xhtml:link rel="alternate" hreflang="${esc(a.hreflang)}" href="${esc(a.href)}"/>`).join('');
            return `<url><loc>${esc(p.loc)}</loc>${alts}</url>`;
          }).join('\n');
          writeFileSync(join(out, `sitemap-${lang}.xml`), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${body}\n</urlset>\n`);
          written.push(lang);
          logger.info(`sitemap-${lang}.xml: ${urls.length} URLs`);
        }
        const index = written.map((l) => `<sitemap><loc>${site}/sitemap-${l}.xml</loc><lastmod>${lastmod}</lastmod></sitemap>`).join('\n');
        writeFileSync(join(out, 'sitemap-index.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${index}\n</sitemapindex>\n`);
      },
    },
  };
}
