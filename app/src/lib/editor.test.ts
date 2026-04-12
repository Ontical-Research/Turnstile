import { describe, it, expect } from 'vitest'
import { tokenRange } from './editor'

/** A minimal doc with 3 lines of known lengths. */
const doc = {
  lines: 3,
  lineLength(lineNum: number): number {
    // Line 1: 10 chars, Line 2: 5 chars, Line 3: 0 chars (empty)
    const lengths: Record<number, number> = { 1: 10, 2: 5, 3: 0 }
    return lengths[lineNum] ?? 0
  },
}

describe('tokenRange bounds checking', () => {
  it('returns a valid range for a token within bounds', () => {
    const result = tokenRange(1, 0, 5, doc)
    expect(result).toEqual({ from: 0, to: 5 })
  })

  it('returns a valid range for a token at end of line', () => {
    const result = tokenRange(1, 5, 5, doc)
    expect(result).toEqual({ from: 5, to: 10 })
  })

  it('returns null when line number exceeds document lines', () => {
    expect(tokenRange(4, 0, 1, doc)).toBeNull()
  })

  it('returns null when line number is zero', () => {
    expect(tokenRange(0, 0, 1, doc)).toBeNull()
  })

  it('returns null when line number is negative', () => {
    expect(tokenRange(-1, 0, 1, doc)).toBeNull()
  })

  it('returns null when col + length exceeds line length', () => {
    // Line 2 has 5 chars; col=3 + length=3 = 6 > 5
    expect(tokenRange(2, 3, 3, doc)).toBeNull()
  })

  it('returns null when col is negative', () => {
    expect(tokenRange(1, -1, 2, doc)).toBeNull()
  })

  it('returns null for any token on an empty line', () => {
    // Line 3 has 0 chars
    expect(tokenRange(3, 0, 1, doc)).toBeNull()
  })

  it('returns a zero-length range on an empty line', () => {
    // A zero-length token at col 0 on an empty line is technically in bounds
    expect(tokenRange(3, 0, 0, doc)).toEqual({ from: 0, to: 0 })
  })
})
