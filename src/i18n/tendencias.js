// Textos del widget "Tendencias en la red" de la portada (el título y la entradilla están en ui.js).
export const tendencias = {
  es: { legend: 'La barra muestra el interés relativo entre estos planes.', searched: (t, n) => `«${t}» · +${n} búsquedas` },
  en: { legend: 'The bar shows relative interest among these plans.', searched: (t, n) => `“${t}” · ${n}+ searches` },
  fr: { legend: 'La barre indique l’intérêt relatif entre ces idées.', searched: (t, n) => `« ${t} » · ${n}+ recherches` },
  de: { legend: 'Der Balken zeigt das relative Interesse an diesen Tipps.', searched: (t, n) => `„${t}“ · ${n}+ Suchanfragen` },
  it: { legend: 'La barra mostra l’interesse relativo tra queste idee.', searched: (t, n) => `«${t}» · ${n}+ ricerche` },
  pt: { legend: 'A barra mostra o interesse relativo entre estas ideias.', searched: (t, n) => `«${t}» · ${n}+ pesquisas` },
};
