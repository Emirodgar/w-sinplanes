import { getJSON, todayISO, addDays } from '../lib/util.mjs';

// Partidos destacados (football-data.org, plan gratuito). Requiere FOOTBALL_DATA_TOKEN.
const COMPETITION = { PD: 'LaLiga', CL: 'Champions League' }; // la API da "Primera Division"

export default async function football(src) {
  const token = process.env[src.secreto];
  const from = todayISO(), to = addDays(from, 14);
  const big = (name = '') => src.equipos_destacados.some((t) => name.includes(t));
  // Estadio del local: la API gratuita no lo da.
  const stadium = (name = '') => Object.entries(src.estadios || {}).find(([team]) => name.includes(team))?.[1] || null;
  const out = [];
  for (const code of src.competiciones) {
    const data = await getJSON(`https://api.football-data.org/v4/competitions/${code}/matches?dateFrom=${from}&dateTo=${to}`, { headers: { 'X-Auth-Token': token } });
    for (const m of data.matches || []) {
      const h = m.homeTeam?.name, a = m.awayTeam?.name;
      const score = Number(big(h)) + Number(big(a));
      // LaLiga: solo cruces entre dos destacados. Champions: cualquier partido con al menos un destacado.
      if (!(score === 2 || (code !== 'PD' && score >= 1))) continue;
      const comp = COMPETITION[code] || m.competition?.name || code;
      const venue = m.venue || stadium(h);
      const local = new Date(m.utcDate).toLocaleString('sv-SE', { timeZone: 'Europe/Madrid' });
      out.push({
        title: `${h} – ${a} (${comp})`,
        description: `Partido de ${comp}${m.matchday ? `, jornada ${m.matchday}` : ''}${venue ? ` en ${venue}` : ''}. Hora peninsular: ${local.slice(11, 16)}.`,
        start: local.slice(0, 10), end: local.slice(0, 10), time: local.slice(11, 16),
        venue,
        match: {
          competition: comp, emblem: m.competition?.emblem || null,
          home: m.homeTeam?.shortName || h, away: m.awayTeam?.shortName || a,
          homeCrest: m.homeTeam?.crest || null, awayCrest: m.awayTeam?.crest || null,
          matchday: m.matchday && /REGULAR|LEAGUE/.test(m.stage || '') ? m.matchday : null,
          stage: m.stage && !/REGULAR|LEAGUE_STAGE/.test(m.stage) ? m.stage : null, // código; la interfaz lo traduce
          venue,
        },
        url: null, scope: 'nacional', kind: 'pantalla', topics: ['pantalla', 'deporte'],
        indoor: true, free: true, price: null, hints: ['fútbol'], lang: 'es',
      });
    }
  }
  return out;
}
