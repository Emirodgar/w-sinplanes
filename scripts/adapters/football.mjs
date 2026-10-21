import { getJSON, todayISO, addDays } from '../lib/util.mjs';

// Partidos destacados (football-data.org, plan gratuito). Requiere FOOTBALL_DATA_TOKEN.
const KNOCKOUT = /FINAL|SEMI|QUARTER|LAST_16|PLAYOFF/;

export default async function football(src) {
  const token = process.env[src.secreto];
  const from = todayISO(), to = addDays(from, 14);
  const big = (name = '') => src.equipos_destacados.some((t) => name.includes(t));
  const out = [];
  for (const code of src.competiciones) {
    const data = await getJSON(`https://api.football-data.org/v4/competitions/${code}/matches?dateFrom=${from}&dateTo=${to}`, { headers: { 'X-Auth-Token': token } });
    for (const m of data.matches || []) {
      const h = m.homeTeam?.name, a = m.awayTeam?.name;
      const score = Number(big(h)) + Number(big(a));
      const knockout = KNOCKOUT.test(m.stage || '');
      if (!(score === 2 || (code !== 'PD' && score >= 1 && knockout))) continue;
      const comp = m.competition?.name || code;
      const local = new Date(m.utcDate).toLocaleString('sv-SE', { timeZone: 'Europe/Madrid' });
      out.push({
        title: `${h} – ${a} (${comp})`,
        description: `Partido de ${comp}${m.matchday ? `, jornada ${m.matchday}` : ''}${m.venue ? ` en ${m.venue}` : ''}. Hora peninsular: ${local.slice(11, 16)}.`,
        start: local.slice(0, 10), end: local.slice(0, 10), time: local.slice(11, 16),
        venue: m.venue || null,
        match: {
          competition: comp, emblem: m.competition?.emblem || null,
          home: m.homeTeam?.shortName || h, away: m.awayTeam?.shortName || a,
          homeCrest: m.homeTeam?.crest || null, awayCrest: m.awayTeam?.crest || null,
          matchday: m.matchday && /REGULAR|LEAGUE/.test(m.stage || '') ? m.matchday : null,
          stage: m.stage && !/REGULAR/.test(m.stage) ? m.stage.replace(/_/g, ' ').toLowerCase() : null,
          venue: m.venue || null,
        },
        url: null, scope: 'nacional', kind: 'pantalla', topics: ['pantalla', 'deporte'],
        indoor: true, free: true, price: null, hints: ['fútbol'], lang: 'es',
      });
    }
  }
  return out;
}
