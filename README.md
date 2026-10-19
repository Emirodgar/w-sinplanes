# sinplanes.com

Agenda de planes en España, en español e inglés, que se actualiza sola cada día con GitHub Actions.

## Cómo funciona

Cada mañana el workflow `daily.yml` hace esto:

1. Convierte `config/seasonal.yml` en planes con fechas reales (calcula Semana Santa, el último miércoles de agosto, etc.).
2. Descarga las fuentes de `config/sources.yml`. Si una falla, se registra en `data/meta.json` y la web se publica igual.
3. Normaliza, clasifica por temas y deduplica.
4. Si existe `GEMINI_API_KEY` (o `ANTHROPIC_API_KEY`), la IA reescribe el resumen, traduce al inglés y afina temas y si es a cubierto. Usa caché por contenido: un evento que no cambia no se vuelve a pagar.
5. Guarda `data/plans.json` en el repo, compila con Astro y publica en GitHub Pages.

Además, `check-sources.yml` prueba todas las fuentes cada lunes y deja el resultado en el resumen del job.

## Puesta en marcha (una sola vez)

1. Crea el repositorio y sube este código a `main`.
2. En Settings > Pages, elige "GitHub Actions" como origen. Para el dominio, apunta el DNS de sinplanes.com a GitHub Pages (el fichero `public/CNAME` ya está).
3. En Settings > Secrets and variables > Actions, añade los secretos que quieras usar:
   - `GEMINI_API_KEY` (Google; modelo por defecto `gemini-2.5-flash`, cambiable con `SINPLANES_MODEL`) o `ANTHROPIC_API_KEY`: traducciones, resúmenes y extracción de prensa. Si hay las dos, manda Gemini. Sin ella, la web funciona con reglas y el texto original.
   - `TMDB_API_KEY`: estrenos de cine (clave gratuita en themoviedb.org).
   - `FOOTBALL_DATA_TOKEN`: partidos destacados (plan gratuito en football-data.org).
4. Lanza "Revisar fuentes" a mano desde la pestaña Actions y corrige en `sources.yml` las que fallen.
5. Lanza "Actualizar y publicar". A partir de ahí, se ejecuta solo.

## Desarrollo local

```bash
npm install
SINPLANES_OFFLINE=1 npm run pipeline   # con datos de ejemplo, sin red
npm run dev
```

## Tareas habituales

- **Añadir un plan de temporada o una cita anual**: edita `config/seasonal.yml`. Las reglas de fecha están documentadas al principio del fichero.
- **Añadir una fuente**: añade una entrada en `config/sources.yml`. Si publica iCal u Opendatasoft, reutiliza los adaptadores `ical` u `opendatasoft`; si no, crea uno en `scripts/adapters/` que devuelva objetos con `title`, `start`, `end`, `municipio`, `provincia`, etc.
- **Presupuesto de IA por ejecución**: `SINPLANES_MAX_AI_CALLS` (30 peticiones), `SINPLANES_AI_RPM` (8 por minuto) y `SINPLANES_AI_MINUTES` (8 min). Si Google responde 429 dos veces seguidas se corta la IA en esa ejecución y el resto se hace al día siguiente. Controlar el coste de IA también con `SINPLANES_MAX_AI_ITEMS` (por defecto 300 planes nuevos por ejecución) y `SINPLANES_MODEL`.

## Fase 2: prensa, tendencias e idiomas

**Prensa regional con IA.** Los feeds de `config/sources.yml` con `adaptador: rss` (21 comprobados) devuelven titulares. Un filtro barato de palabras de agenda descarta lo evidente y la IA decide cuáles anuncian un plan con fecha, lo estructura y redacta un resumen propio. Sin clave de IA esos feeds se descargan pero no se procesan.
- Todo se guarda en `data/cache/press.json`: no se paga dos veces por el mismo titular y el plan sigue publicado cuando el titular sale del feed.
- **Revisión**: lo que la IA marca con confianza menor de 0,7 (o sin provincia reconocible) **no se publica**. Se escribe en `data/review.json` y el workflow abre un Issue con etiqueta `revisar`. Para decidir, copia el id en `config/revision.json` (`aprobados` o `rechazados`) y haz commit.
- `SINPLANES_MAX_PRESS` (60 titulares nuevos por ejecución) y `SINPLANES_CONF_MIN` (0,7) controlan coste y exigencia.
- `npm run check-sources` avisa de feeds caídos, vacíos u obsoletos (sin nada nuevo en 30 días).

**Google Trends.** Cada día se lee `trends.google.com/trending/rss?geo=ES` y se guarda un historial de 14 días en `data/trends.json`. Un plan "conecta" si el término aparece en su título, resumen o municipio; los términos que conectan con más de 8 planes se ignoran por genéricos. La señal solo reordena (`boost`) y alimenta el widget "Lo que está sonando"; nunca crea páginas.

**Idiomas.** Español (raíz) más `/en/`, `/fr/`, `/de/`, `/it/` y `/pt/`, con segmentos de URL traducidos (`/fr/lieux/`, `/de/orte/`, `/it/luoghi/`…) y meses y temas con slug propio. Un único router (`src/pages/[...route].astro`) genera todas las páginas; los textos de interfaz están en `src/i18n/ui.js`.
- La traducción a fr/de/it/pt es por IA, con caché en `data/cache/translations.json`. Se traduce el calendario propio, los planes de prensa y los eventos de datos abiertos de las próximas 3 semanas (`SINPLANES_MAX_TRANSLATE`, 100 planes nuevos por ejecución).
- Un plan sin traducción propia se muestra en inglés (con `lang="en"`) y `noindex`; si ni siquiera tiene inglés, solo existe en español. hreflang y sitemap incluyen únicamente páginas con texto propio en ese idioma.

## Decisiones de contenido

- Nunca se publica el texto original completo de una fuente: solo un resumen y el enlace.
- Los eventos pasados mantienen su página 30 días con `noindex`; después desaparecen.
- Las páginas de listado con menos de 3 planes llevan `noindex` para no generar contenido pobre.
- Prensa: la IA nunca copia texto; cada plan enlaza a la noticia. Revisa las condiciones de reutilización de cada feed antes de activarlo.
- Los planes "para ver" (partidos, estrenos, galas) se marcan como `pantalla` y no llevan marcado Event, porque no tienen lugar físico.
