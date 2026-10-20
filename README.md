# sinplanes.com

Agenda de planes en España, en seis idiomas, con una estructura fija que se enriquece sola con GitHub Actions.

## Arquitectura: esqueleto fijo + datos que lo enriquecen

El sitio tiene **dos capas** que nunca se mezclan en un mismo workflow:

| Capa | Qué contiene | De dónde sale | Cuándo cambia |
|---|---|---|---|
| **Esqueleto fijo** | Portada, temas, comunidades y las 52 provincias, los 12 meses, los planes estacionales y las citas anuales (Semana Santa, Tomatina, Super Bowl…), en 6 idiomas (876 páginas) | Solo `config/` (+ traducciones ya cacheadas). Sin red ni IA | Al editar `config/` o el código |
| **Datos** | Eventos de agendas abiertas y de prensa, resúmenes, traducciones, tendencias | `data/events.json`, `data/trends.json` | Los crons |

- **El esqueleto existe siempre.** `scripts/site-data.mjs` (se ejecuta solo antes de cada `build`) lo compone desde `config/seasonal.yml` calculando las fechas del año en curso, y le suma `data/events.json` si existe. Si todos los crons llevan semanas caídos, el sitio sigue completo: los eventos pasados caducan solos y el calendario estacional sigue vigente. `npm run check-skeleton` falla si falta una sola página del esqueleto, y el despliegue se cancela.
- **Los crons solo actualizan datos.** Cada uno hace un commit `[skip ci]` en `data/` y nunca construye el sitio:
  - `datos-agendas.yml` (diario, ~6:00): agendas de datos abiertos y tendencias. **Sin IA**, así que es fiable.
  - `datos-ia.yml` (diario, ~7:00): prensa regional, resúmenes y traducciones con IA, con presupuesto por ejecución. Si falla, no afecta a nada más.
  - Los dos usan varios disparadores y una marca de "ya hecho hoy" (`data/runs/*.json`) porque GitHub retrasa o se salta algunos `schedule`.
- **El despliegue es independiente.** `deploy.yml` construye con lo que haya en el repo y publica; no usa secretos ni APIs. Se lanza al cambiar código o `config/`, al terminar cada workflow de datos y una vez al día de respaldo (para que cambien el mes y el fin de semana de la portada).
- **Fuentes y presupuesto**: una fuente caída se anota en `data/meta.json` y nunca bloquea nada. `check-sources.yml` prueba todas las fuentes cada lunes.

Qué hace el pipeline de datos (`npm run pipeline`):

1. Descarga las fuentes de `config/sources.yml`, normaliza, clasifica por temas y deduplica.
2. Prensa: extrae planes con IA (ver Fase 2).
3. Si existe `GEMINI_API_KEY` (o `ANTHROPIC_API_KEY`), reescribe resúmenes y traduce. Usa caché por contenido: un evento que no cambia no se vuelve a pagar. Con `SINPLANES_NO_AI=1` no llama a la IA, pero reaplica lo cacheado.
4. Guarda `data/events.json` (solo eventos externos) y actualiza el historial de tendencias.

## Puesta en marcha (una sola vez)

1. Crea el repositorio y sube este código a `main`.
2. En Settings > Pages, elige "GitHub Actions" como origen. Para el dominio, apunta el DNS de sinplanes.com a GitHub Pages (el fichero `public/CNAME` ya está).
3. En Settings > Secrets and variables > Actions, añade los secretos que quieras usar:
   - `GEMINI_API_KEY` (Google; modelo por defecto `gemini-2.5-flash-lite`, cambiable con `SINPLANES_MODEL`) o `ANTHROPIC_API_KEY`: traducciones, resúmenes y extracción de prensa. Si hay las dos, manda Gemini. Sin ella, la web funciona con reglas y el texto original.
   - `TMDB_API_KEY`: estrenos de cine (clave gratuita en themoviedb.org).
   - `FOOTBALL_DATA_TOKEN`: partidos destacados (plan gratuito en football-data.org).
4. Lanza "Revisar fuentes" a mano desde la pestaña Actions y corrige en `sources.yml` las que fallen.
5. Lanza "Desplegar sitio" (el esqueleto sale ya, sin datos) y después "Datos · agendas y tendencias" y "Datos · prensa, resúmenes y traducciones". A partir de ahí, se ejecutan solos.

## Desarrollo local

```bash
npm install
npm run dev                              # compone el esqueleto y arranca (sin necesitar datos)
SINPLANES_OFFLINE=1 npm run pipeline     # opcional: eventos de ejemplo, sin red
```

## Tareas habituales

- **Añadir un plan de temporada o una cita anual**: edita `config/seasonal.yml`. Las reglas de fecha están documentadas al principio del fichero.
- **Libro recomendado y página de libros**: edita `config/libros.yml` (instrucciones al principio del fichero). La portada y la página `/libros/` salen de ahí; el histórico se calcula solo desde `inicio`. Las portadas van en `public/img/libros/`.
- **Cartelera de cine**: la renueva cada día `datos-agendas.yml` con `TMDB_API_KEY` (`scripts/lib/cartelera.mjs`, sin IA) y la guarda en `data/cartelera.json`. Si el secreto falta o la cartelera tiene más de 21 días, el widget no se muestra. TMDB exige la atribución que ya lleva el widget.
- **Añadir una fuente**: añade una entrada en `config/sources.yml`. Si publica iCal u Opendatasoft, reutiliza los adaptadores `ical` u `opendatasoft`; si no, crea uno en `scripts/adapters/` que devuelva objetos con `title`, `start`, `end`, `municipio`, `provincia`, etc.
- **Presupuesto de IA por ejecución**: `SINPLANES_MAX_AI_CALLS` (30 peticiones), `SINPLANES_AI_RPM` (8 por minuto) y `SINPLANES_AI_MINUTES` (8 min). Si Google responde 429 dos veces seguidas se corta la IA en esa ejecución y el resto se hace al día siguiente. Controlar el coste de IA también con `SINPLANES_MAX_AI_ITEMS` (por defecto 100 planes nuevos por ejecución) y `SINPLANES_MODEL`.

## Fase 2: prensa, tendencias e idiomas

**Prensa regional con IA.** Los feeds de `config/sources.yml` con `adaptador: rss` (21 comprobados) devuelven titulares. Un filtro barato de palabras de agenda descarta lo evidente y la IA decide cuáles anuncian un plan con fecha, lo estructura y redacta un resumen propio. Sin clave de IA esos feeds se descargan pero no se procesan.
- Todo se guarda en `data/cache/press.json`: no se paga dos veces por el mismo titular y el plan sigue publicado cuando el titular sale del feed.
- **Revisión**: lo que la IA marca con confianza menor de 0,7 (o sin provincia reconocible) **no se publica**. Se escribe en `data/review.json` y el workflow abre un Issue con etiqueta `revisar`. Para decidir, copia el id en `config/revision.json` (`aprobados` o `rechazados`) y haz commit.
- `SINPLANES_MAX_PRESS` (60 titulares nuevos por ejecución) y `SINPLANES_CONF_MIN` (0,7) controlan coste y exigencia.
- `npm run check-sources` avisa de feeds caídos, vacíos u obsoletos (sin nada nuevo en 30 días).

**Google Trends.** Cada día se lee `trends.google.com/trending/rss?geo=ES` y se guarda un historial de 14 días en `data/trends.json`. Un plan "conecta" si el término aparece en su título, resumen o municipio; los términos que conectan con más de 8 planes se ignoran por genéricos. La señal solo reordena (`boost`) y alimenta el widget "Lo que está sonando"; nunca crea páginas.

**Idiomas.** Español (raíz) más `/en/`, `/fr/`, `/de/`, `/it/` y `/pt/`, con segmentos de URL traducidos (`/fr/lieux/`, `/de/orte/`, `/it/luoghi/`…) y meses y temas con slug propio. Un único router (`src/pages/[...route].astro`) genera todas las páginas; los textos de interfaz están en `src/i18n/ui.js`.
- La traducción a fr/de/it/pt es por IA, con caché en `data/cache/translations.json`. Se traduce el calendario propio, los planes de prensa y los eventos de datos abiertos de las próximas 3 semanas (`SINPLANES_MAX_TRANSLATE`, 100 planes nuevos por ejecución).
- Un plan sin traducción propia se muestra en inglés (con `lang="en"`) y `noindex`; si ni siquiera tiene inglés, solo existe en español. hreflang y sitemaps incluyen únicamente páginas con texto propio en ese idioma. Tras el build, `scripts/lib/sitemaps.mjs` lee el HTML generado y escribe `sitemap-{es,en,fr,de,it,pt}.xml` (solo páginas sin `noindex`) y `sitemap-index.xml`; todos están en `robots.txt`.

## Decisiones de contenido

- Nunca se publica el texto original completo de una fuente: solo un resumen y el enlace.
- Los eventos pasados mantienen su página 30 días con `noindex`; después desaparecen.
- Las páginas de listado con menos de 3 planes llevan `noindex` para no generar contenido pobre.
- Prensa: la IA nunca copia texto; cada plan enlaza a la noticia. Revisa las condiciones de reutilización de cada feed antes de activarlo.
- Los planes "para ver" (partidos, estrenos, galas) se marcan como `pantalla` y no llevan marcado Event, porque no tienen lugar físico.
