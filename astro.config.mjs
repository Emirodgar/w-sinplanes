import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { readFileSync } from 'node:fs';

// Los idiomas y las rutas las gestiona src/pages/[...route].astro; aquí solo se declaran para el sitemap.
const LOCALES = { es: 'es-ES', en: 'en', fr: 'fr', de: 'de', it: 'it', pt: 'pt' };

// El sitemap solo incluye planes indexables: no pasados y con texto propio en ese idioma.
const plans = JSON.parse(readFileSync(new URL('./data/plans.json', import.meta.url), 'utf8'));
const meta = JSON.parse(readFileSync(new URL('./data/site.json', import.meta.url), 'utf8'));
const bySlug = new Map(plans.map((p) => [p.slug, p]));
const planPath = /^\/(?:(en|fr|de|it|pt)\/)?(?:plan|piano|plano)\/([^/]+)\/$/;

function indexable(pathname) {
  const m = pathname.match(planPath);
  if (!m) return true;
  const [, lang = 'es', slug] = m;
  const p = bySlug.get(slug);
  if (!p) return true;
  if (p.end && p.end < meta.today) return false;
  return lang === 'es' || Boolean(p.title?.[lang]);
}

export default defineConfig({
  site: 'https://sinplanes.com',
  trailingSlash: 'always',
  integrations: [
    sitemap({
      i18n: { defaultLocale: 'es', locales: LOCALES },
      filter: (page) => !page.includes('/404') && indexable(new URL(page).pathname),
    }),
  ],
});
