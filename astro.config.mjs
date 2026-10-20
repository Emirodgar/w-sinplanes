import { defineConfig } from 'astro/config';
import { sitemaps } from './scripts/lib/sitemaps.mjs';

// Idiomas y rutas: src/pages/[...route].astro. Los sitemaps (uno por idioma, solo páginas sin noindex) se generan tras el build.

export default defineConfig({
  site: 'https://sinplanes.com',
  trailingSlash: 'ignore',
  integrations: [sitemaps({ site: 'https://sinplanes.com' })],
});
