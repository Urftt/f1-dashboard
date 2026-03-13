import { describe, it, expect } from 'vitest'
import {
  getCompoundColor,
  getCompoundLetter,
  COMPOUND_COLOR,
  COMPOUND_LETTER,
  UNKNOWN_COMPOUND_COLOR,
  UNKNOWN_COMPOUND_LETTER,
} from './compounds'

describe('getCompoundColor', () => {
  it('returns correct hex for SOFT', () => {
    expect(getCompoundColor('SOFT')).toBe('#e10600')
  })

  it('returns correct hex for MEDIUM', () => {
    expect(getCompoundColor('MEDIUM')).toBe('#ffd700')
  })

  it('returns correct hex for HARD', () => {
    expect(getCompoundColor('HARD')).toBe('#ffffff')
  })

  it('returns correct hex for INTERMEDIATE', () => {
    expect(getCompoundColor('INTERMEDIATE')).toBe('#00cc00')
  })

  it('returns correct hex for WET', () => {
    expect(getCompoundColor('WET')).toBe('#0066ff')
  })

  it('returns UNKNOWN_COMPOUND_COLOR for null', () => {
    expect(getCompoundColor(null)).toBe(UNKNOWN_COMPOUND_COLOR)
  })

  it('returns UNKNOWN_COMPOUND_COLOR for unrecognized string', () => {
    expect(getCompoundColor('HYPERSOFT')).toBe(UNKNOWN_COMPOUND_COLOR)
  })

  it('COMPOUND_COLOR map contains all expected compounds', () => {
    expect(Object.keys(COMPOUND_COLOR)).toEqual([
      'SOFT',
      'MEDIUM',
      'HARD',
      'INTERMEDIATE',
      'WET',
    ])
  })
})

describe('getCompoundLetter', () => {
  it('returns S for SOFT', () => {
    expect(getCompoundLetter('SOFT')).toBe('S')
  })

  it('returns M for MEDIUM', () => {
    expect(getCompoundLetter('MEDIUM')).toBe('M')
  })

  it('returns H for HARD', () => {
    expect(getCompoundLetter('HARD')).toBe('H')
  })

  it('returns I for INTERMEDIATE', () => {
    expect(getCompoundLetter('INTERMEDIATE')).toBe('I')
  })

  it('returns W for WET', () => {
    expect(getCompoundLetter('WET')).toBe('W')
  })

  it('returns ? for null', () => {
    expect(getCompoundLetter(null)).toBe('?')
  })

  it('returns ? for unrecognized string', () => {
    expect(getCompoundLetter('HYPERSOFT')).toBe('?')
  })

  it('COMPOUND_LETTER map contains all expected compounds', () => {
    expect(Object.keys(COMPOUND_LETTER)).toEqual([
      'SOFT',
      'MEDIUM',
      'HARD',
      'INTERMEDIATE',
      'WET',
    ])
  })

  it('UNKNOWN_COMPOUND_LETTER is ?', () => {
    expect(UNKNOWN_COMPOUND_LETTER).toBe('?')
  })
})
