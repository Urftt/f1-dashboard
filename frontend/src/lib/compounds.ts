export const COMPOUND_COLOR: Record<string, string> = {
  SOFT: '#e10600',
  MEDIUM: '#ffd700',
  HARD: '#ffffff',
  INTERMEDIATE: '#00cc00',
  WET: '#0066ff',
}

export const COMPOUND_LETTER: Record<string, string> = {
  SOFT: 'S',
  MEDIUM: 'M',
  HARD: 'H',
  INTERMEDIATE: 'I',
  WET: 'W',
}

export const UNKNOWN_COMPOUND_COLOR = '#555555'
export const UNKNOWN_COMPOUND_LETTER = '?'

export function getCompoundColor(compound: string | null): string {
  if (compound === null) return UNKNOWN_COMPOUND_COLOR
  return COMPOUND_COLOR[compound] ?? UNKNOWN_COMPOUND_COLOR
}

export function getCompoundLetter(compound: string | null): string {
  if (compound === null) return UNKNOWN_COMPOUND_LETTER
  return COMPOUND_LETTER[compound] ?? UNKNOWN_COMPOUND_LETTER
}
