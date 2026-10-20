// Verifica que dist/ contiene TODO el esqueleto fijo, calculado solo desde config/. Si falta algo, el
// despliegue se cancela: unos datos rotos nunca pueden dejar el sitio sin páginas.
import { existsSync } from 'node:fs';
import path from 'node:path';
import { load as yamlLoad } from 'js-yaml';
import { readFileSync } from 'node:fs';
import { ROOT, slugify, readJSON } from './lib/util.mjs';
import { readLugares } from './lib/seasonal.mjs';

const LANGS = ['es', 'en', 'fr', 'de', 'it', 'pt'];
const SEG = {
  es: { plan: 'plan', topics: 'temas', places: 'lugares', calendar: 'calendario' }, en: { plan: 'plan', topics: 'topics', places: 'places', calendar: 'calendar' },
  fr: { plan: 'plan', topics: 'themes', places: 'lieux', calendar: 'calendrier' }, de: { plan: 'plan', topics: 'themen', places: 'orte', calendar: 'kalender' },
  it: { plan: 'piano', topics: 'temi', places: 'luoghi', calendar: 'calendario' }, pt: { plan: 'plano', topics: 'temas', places: 'locais', calendar: 'calendario' },
};
const MONTHS = {
  es: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'],
  en: ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'],
  fr: ['janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin', 'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre'],
  de: ['januar', 'februar', 'maerz', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'dezember'],
  it: ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'],
  pt: ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'],
};

const topics = readJSON('config/topics.json');
const geo = readJSON('config/geo.json');
const doc = yamlLoad(readFileSync(path.join(ROOT, 'config/seasonal.yml'), 'utf8'));
const planSlugs = [...(doc.temporada || []), ...(doc.citas || []), ...readLugares()].map((x) => x.id);

const expected = [];
for (const l of LANGS) {
  const pre = l === 'es' ? '' : `${l}/`;
  const s = SEG[l];
  expected.push(`${pre}`, `${pre}${s.topics}`, `${pre}${s.places}`, `${pre}${s.calendar}`);
  topics.forEach((t) => expected.push(`${pre}${s.topics}/${l === 'es' ? t.id : t.slugs[l]}`));
  geo.forEach((c) => { expected.push(`${pre}${s.places}/${c.slug}`); c.provincias.forEach((p) => expected.push(`${pre}${s.places}/${c.slug}/${slugify(p)}`)); });
  MONTHS[l].forEach((m) => expected.push(`${pre}${s.calendar}/${m}`));
  planSlugs.forEach((id) => expected.push(`${pre}${s.plan}/${id}`));
}

const missing = expected.filter((e) => !existsSync(path.join(ROOT, 'dist', e, 'index.html')));
console.log(`Esqueleto: ${expected.length} páginas esperadas, ${missing.length} ausentes.`);
if (missing.length) { console.error(missing.slice(0, 30).join('\n')); process.exit(1); }
