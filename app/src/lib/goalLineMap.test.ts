import { describe, it, expect } from 'vitest'
import { buildGoalLineMap } from './goalLineMap'

describe('buildGoalLineMap', () => {
  it('returns empty array for empty full text', () => {
    expect(buildGoalLineMap('', [])).toEqual([])
    expect(buildGoalLineMap('', ['⊢ p'])).toEqual([])
  })

  it('returns empty array when full text has no code block', () => {
    expect(buildGoalLineMap('plain text only', ['⊢ p'])).toEqual([])
  })

  it('maps each code-block line to the last per-line goal containing it', () => {
    // Mimic the worked example from the plan:
    //   line 1: "⊢ p ∧ q"
    //   line 2: "case left ... ⊢ p" and "case right ... ⊢ q"
    //   line 3: only "case right ... ⊢ q"
    //   line 4: "" (no goals)
    const full = [
      '```lean',
      'case left',
      'hp : p',
      'hq : q',
      '⊢ p',
      '',
      'case right',
      'hp : p',
      'hq : q',
      '⊢ q',
      '```',
    ].join('\n')

    const line1 = 'hp : p\nhq : q\n⊢ p ∧ q'
    const line2 = [
      'case left',
      'hp : p',
      'hq : q',
      '⊢ p',
      '',
      'case right',
      'hp : p',
      'hq : q',
      '⊢ q',
    ].join('\n')
    const line3 = ['case right', 'hp : p', 'hq : q', '⊢ q'].join('\n')
    const line4 = ''
    const perLine = [line1, line2, line3, line4]

    const map = buildGoalLineMap(full, perLine)

    // 10 lines in the code block in full (trailing blank from newline before
    // closing fence): case left, hp, hq, ⊢ p, "", case right, hp, hq, ⊢ q, ""
    expect(map).toEqual([
      2, // "case left" — only in line2
      3, // "hp : p" — in all of 1..3; last is 3
      3, // "hq : q" — same
      2, // "⊢ p" — only line2 has it
      null, // "" — blank lines are not matched
      3, // "case right" — in line2 and line3; last is 3
      3, // "hp : p" — last 3
      3, // "hq : q" — last 3
      3, // "⊢ q" — in line2 and line3; last is 3
      null, // trailing blank
    ])
  })

  it('line matching uses exact string equality', () => {
    const full = '```\n⊢ p\n```'
    const map = buildGoalLineMap(full, ['⊢ p ', '  ⊢ p'])
    // Neither matches "⊢ p" exactly. Two entries: the goal line and trailing blank.
    expect(map).toEqual([null, null])
  })

  it('iterates text blocks (skipped) and code blocks in order', () => {
    const full = [
      'Some intro text',
      '',
      '```lean',
      'goal A',
      '```',
      '',
      'More prose',
      '',
      '```lean',
      'goal B',
      '```',
    ].join('\n')
    const perLine = ['goal A', 'goal A\ngoal B']
    expect(buildGoalLineMap(full, perLine)).toEqual([
      2, // goal A — last match at line 2 (index 1)
      null, // trailing blank line in code block 1
      2, // goal B — only in line 2
      null, // trailing blank line in code block 2
    ])
  })

  it('returns null for lines with no match', () => {
    const full = '```\nno match\n```'
    expect(buildGoalLineMap(full, ['something else', 'also different'])).toEqual([
      null,
      null, // trailing blank
    ])
  })

  it('handles empty per-line goals', () => {
    const full = '```\n⊢ p\n```'
    // `parseBlocks` preserves the trailing newline inside the code block, so
    // the flattened lines are ['⊢ p', ''] — the blank is always null.
    expect(buildGoalLineMap(full, [])).toEqual([null, null])
  })
})
