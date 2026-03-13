import { describe, it, expect } from 'vitest'
import { makeReplayCursorShape } from './plotlyShapes'

describe('makeReplayCursorShape', () => {
  it('returns null for currentLap 0', () => {
    expect(makeReplayCursorShape(0)).toBeNull()
  })

  it('returns null for negative currentLap', () => {
    expect(makeReplayCursorShape(-5)).toBeNull()
  })

  it('returns shape with correct x0 and x1 for lap 15', () => {
    const shape = makeReplayCursorShape(15)
    expect(shape).not.toBeNull()
    expect(shape!.x0).toBe(15)
    expect(shape!.x1).toBe(15)
  })

  it('returns shape with yref paper', () => {
    const shape = makeReplayCursorShape(10)
    expect(shape!.yref).toBe('paper')
  })

  it('returns shape with y0=0 and y1=1', () => {
    const shape = makeReplayCursorShape(10)
    expect(shape!.y0).toBe(0)
    expect(shape!.y1).toBe(1)
  })

  it('returns shape with correct line color', () => {
    const shape = makeReplayCursorShape(10)
    expect(shape!.line!.color).toBe('rgba(255,255,255,0.6)')
  })

  it('returns shape with correct line width', () => {
    const shape = makeReplayCursorShape(10)
    expect(shape!.line!.width).toBe(1.5)
  })

  it('returns shape with dash line style', () => {
    const shape = makeReplayCursorShape(10)
    expect(shape!.line!.dash).toBe('dash')
  })

  it('returns shape with type line', () => {
    const shape = makeReplayCursorShape(10)
    expect(shape!.type).toBe('line')
  })
})
