// Carreras populares de España (config/carreras.yml) para la página /carreras/.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { load as yamlLoad } from 'js-yaml';

const WHEN = { principios: 0, mediados: 1, finales: 2 };

// Orden de calendario (enero a diciembre); las de fecha variable (mes 0) van al final.
export const races = (yamlLoad(readFileSync(path.join(process.cwd(), 'config/carreras.yml'), 'utf8')).carreras || [])
  .slice()
  .sort((a, b) => (a.mes || 13) - (b.mes || 13) || (WHEN[a.cuando] ?? 3) - (WHEN[b.cuando] ?? 3) || a.nombre.localeCompare(b.nombre, 'es'));
