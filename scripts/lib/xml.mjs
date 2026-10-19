// Lector mínimo de RSS 2.0 y Atom (sin dependencias). Suficiente para feeds de prensa y Google Trends.
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

function decode(s) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
}

/** Contenido de texto de un fragmento: CDATA tal cual, el resto con entidades decodificadas. */
function text(raw) {
  const cdata = raw.match(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/);
  return (cdata ? cdata[1] : decode(raw)).trim();
}

export function tag(block, name) {
  const re = new RegExp(`<${name}\\b[^>]*?(?:/>|>([\\s\\S]*?)</${name}>)`, 'i');
  const m = block.match(re);
  return m && m[1] !== undefined ? text(m[1]) : '';
}

export function tagAll(block, name) {
  const re = new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)</${name}>`, 'gi');
  return [...block.matchAll(re)].map((m) => text(m[1]));
}

export function parseFeed(xml) {
  const blocks = [...xml.matchAll(/<(item|entry)\b[\s\S]*?<\/\1>/gi)].map((m) => m[0]);
  return blocks.map((b) => ({
    title: tag(b, 'title'),
    link: tag(b, 'link') || (b.match(/<link\b[^>]*href=["']([^"']+)["']/i) || [])[1] || '',
    description: tag(b, 'description') || tag(b, 'summary'),
    content: tag(b, 'content:encoded') || tag(b, 'content'),
    published: tag(b, 'pubDate') || tag(b, 'published') || tag(b, 'updated') || tag(b, 'dc:date'),
    guid: tag(b, 'guid') || tag(b, 'id'),
    raw: b,
  }));
}

/** 'YYYY-MM-DD' (hora de Madrid) de una fecha RSS/ISO, o null. */
export function feedDay(s) {
  const d = new Date(s);
  return isNaN(d) ? null : d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
}
