// Utilidades de la sección de podcasts (widget de la portada y página /podcasts/).
export const PLATFORMS = { spotify: 'Spotify', apple: 'Apple Podcasts', youtube: 'YouTube', web: 'Web' };

// "Semana del 19 de octubre" a partir del lunes ISO de la semana.
export const weekLabel = (L, lang, iso) =>
  `${L.podcastWeekOf} ${new Date(`${iso}T00:00:00Z`).toLocaleDateString(lang, { day: 'numeric', month: 'long', timeZone: 'UTC' })}`;

// Botones de escucha: solo las plataformas con URL. Entra `enlaces` del YAML, sale [{ key, name, href }].
export const listenLinks = (enlaces) =>
  Object.entries(PLATFORMS).filter(([k]) => enlaces?.[k]).map(([key, name]) => ({ key, name, href: enlaces[key] }));
