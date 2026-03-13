/**
 * Driver color, name, and team lookup tables covering the 2023-2025 F1 grid.
 * Colors represent the team's primary brand color.
 */

export const DRIVER_COLORS: Record<string, string> = {
  // Red Bull Racing
  VER: '#3671C6',
  PER: '#3671C6',

  // Mercedes
  HAM: '#27F4D2',
  RUS: '#27F4D2',

  // Ferrari
  LEC: '#E8002D',
  SAI: '#E8002D',
  BEA: '#E8002D', // 2025: Oliver Bearman

  // McLaren
  NOR: '#FF8000',
  PIA: '#FF8000',

  // Aston Martin
  ALO: '#229971',
  STR: '#229971',

  // Alpine / BWT Alpine
  OCO: '#FF87BC',
  GAS: '#FF87BC',
  DOO: '#FF87BC', // 2025: Jack Doohan

  // Sauber / Alfa Romeo
  ZHO: '#52E252',
  BOT: '#52E252',

  // RB / AlphaTauri / VCARB
  TSU: '#6692FF',
  RIC: '#6692FF',
  LAW: '#6692FF',
  HAD: '#6692FF', // 2025: Isack Hadjar

  // Williams
  ALB: '#B6BABD',
  SAR: '#B6BABD',
  COL: '#B6BABD', // 2025: Franco Colapinto / Carlos Sainz

  // Haas
  MAG: '#B6BABD',
  HUL: '#B6BABD',
}

export const DRIVER_FULL_NAMES: Record<string, string> = {
  // Red Bull Racing
  VER: 'Max Verstappen',
  PER: 'Sergio Perez',

  // Mercedes
  HAM: 'Lewis Hamilton',
  RUS: 'George Russell',

  // Ferrari
  LEC: 'Charles Leclerc',
  SAI: 'Carlos Sainz',
  BEA: 'Oliver Bearman',

  // McLaren
  NOR: 'Lando Norris',
  PIA: 'Oscar Piastri',

  // Aston Martin
  ALO: 'Fernando Alonso',
  STR: 'Lance Stroll',

  // Alpine
  OCO: 'Esteban Ocon',
  GAS: 'Pierre Gasly',
  DOO: 'Jack Doohan',

  // Sauber / Alfa Romeo
  ZHO: 'Guanyu Zhou',
  BOT: 'Valtteri Bottas',

  // RB / AlphaTauri / VCARB
  TSU: 'Yuki Tsunoda',
  RIC: 'Daniel Ricciardo',
  LAW: 'Liam Lawson',
  HAD: 'Isack Hadjar',

  // Williams
  ALB: 'Alexander Albon',
  SAR: 'Logan Sargeant',
  COL: 'Franco Colapinto',

  // Haas
  MAG: 'Kevin Magnussen',
  HUL: 'Nico Hulkenberg',
}

export const DRIVER_TEAMS: Record<string, string> = {
  // Red Bull Racing
  VER: 'Red Bull Racing',
  PER: 'Red Bull Racing',

  // Mercedes
  HAM: 'Mercedes',
  RUS: 'Mercedes',

  // Ferrari
  LEC: 'Ferrari',
  SAI: 'Ferrari',
  BEA: 'Ferrari',

  // McLaren
  NOR: 'McLaren',
  PIA: 'McLaren',

  // Aston Martin
  ALO: 'Aston Martin',
  STR: 'Aston Martin',

  // Alpine
  OCO: 'Alpine',
  GAS: 'Alpine',
  DOO: 'Alpine',

  // Sauber / Alfa Romeo
  ZHO: 'Sauber',
  BOT: 'Sauber',

  // RB / AlphaTauri / VCARB
  TSU: 'RB',
  RIC: 'RB',
  LAW: 'RB',
  HAD: 'RB',

  // Williams
  ALB: 'Williams',
  SAR: 'Williams',
  COL: 'Williams',

  // Haas
  MAG: 'Haas',
  HUL: 'Haas',
}

/**
 * Returns the team hex color for a driver abbreviation.
 * Falls back to gray (#888888) for unknown drivers.
 */
export function getDriverColor(abbreviation: string): string {
  return DRIVER_COLORS[abbreviation] ?? '#888888'
}
