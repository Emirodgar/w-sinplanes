// Línea "amanece / anochece" para los widgets con ubicación (datos de Open-Meteo, hora local del lugar).
// Sin dependencias: la importan tanto el servidor como los scripts del navegador.
export const SOL = {
  es: { rise: 'Amanece', set: 'Anochece' },
  en: { rise: 'Sunrise', set: 'Sunset' },
  fr: { rise: 'Lever du soleil', set: 'Coucher du soleil' },
  de: { rise: 'Sonnenaufgang', set: 'Sonnenuntergang' },
  it: { rise: 'Alba', set: 'Tramonto' },
  pt: { rise: 'Nascer do sol', set: 'Pôr do sol' },
};

const svg = (d) => `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const ICON = {
  rise: svg('<path d="M17 18a5 5 0 0 0-10 0"/><path d="M12 2v7"/><path d="m8.5 5.5 3.5-3.5 3.5 3.5"/><path d="M2 18h20"/>'),
  set: svg('<path d="M17 18a5 5 0 0 0-10 0"/><path d="M12 9V2"/><path d="m8.5 5.5 3.5 3.5 3.5-3.5"/><path d="M2 18h20"/>'),
};

/** HTML de la línea para el día `i` de la previsión diaria `daily`; cadena vacía si faltan los datos. `s` = { rise, set } en el idioma. */
export function sunHtml(daily, i, s) {
  const up = daily?.sunrise?.[i]?.slice(11, 16), down = daily?.sunset?.[i]?.slice(11, 16);
  if (!up || !down) return '';
  return `<p class="sun"><span>${ICON.rise}${s.rise} <b>${up}</b></span><span>${ICON.set}${s.set} <b>${down}</b></span></p>`;
}
