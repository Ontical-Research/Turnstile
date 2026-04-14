import { describe, it, expect } from 'vitest'
import type { FileProgressRange } from './tauri'
import { computeProcessingLines, type ProgressDocLike } from './fileProgress'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal ProgressDocLike — only `lines` is read by computeProcessingLines. */
function makeDoc(lines: number): ProgressDocLike {
  return { lines }
}

function range(startLine: number, endLine: number): FileProgressRange {
  return { start_line: startLine, end_line: endLine }
}

// ---------------------------------------------------------------------------
// computeProcessingLines
// ---------------------------------------------------------------------------

describe('computeProcessingLines', () => {
  it('returns [] when ranges is empty', () => {
    expect(computeProcessingLines(makeDoc(5), [])).toEqual([])
  })

  it('returns a single line for a one-line range', () => {
    expect(computeProcessingLines(makeDoc(5), [range(2, 2)])).toEqual([2])
  })

  it('expands a multi-line range into each line inclusively', () => {
    expect(computeProcessingLines(makeDoc(5), [range(2, 4)])).toEqual([2, 3, 4])
  })

  it('clamps start_line below 1 up to 1', () => {
    expect(computeProcessingLines(makeDoc(5), [range(-5, 2)])).toEqual([1, 2])
    expect(computeProcessingLines(makeDoc(5), [range(0, 2)])).toEqual([1, 2])
  })

  it('clamps end_line above doc.lines down to doc.lines', () => {
    expect(computeProcessingLines(makeDoc(5), [range(4, 999)])).toEqual([4, 5])
  })

  it('dedupes overlapping ranges and returns sorted lines', () => {
    expect(computeProcessingLines(makeDoc(10), [range(1, 3), range(2, 4)])).toEqual([1, 2, 3, 4])
  })

  it('skips inverted ranges where start > end', () => {
    expect(computeProcessingLines(makeDoc(10), [range(5, 2)])).toEqual([])
  })

  it('skips fully out-of-bounds ranges', () => {
    // start beyond doc.lines — after clamping end down to doc.lines, start > end.
    expect(computeProcessingLines(makeDoc(5), [range(100, 200)])).toEqual([])
  })

  it('combines valid and OOB ranges, returning only the valid lines sorted', () => {
    const result = computeProcessingLines(makeDoc(5), [range(100, 200), range(2, 3), range(1, 1)])
    expect(result).toEqual([1, 2, 3])
  })
})
