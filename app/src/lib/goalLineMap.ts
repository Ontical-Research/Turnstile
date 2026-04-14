/**
 * Map rendered goal-state lines back to the Formal Proof line that produced
 * them.
 *
 * For each text line in the full-proof goal, find the last proof line whose
 * rendered goal state contains that exact text line. The resulting array is
 * parallel to the flattened iteration of code-block lines in the panel:
 *
 * - iterate `parseBlocks(goalText)` in order,
 * - for each `code` block, split `block.content` on `\n`,
 * - the i-th element of the returned array corresponds to the i-th code-block
 *   line in that flat order.
 *
 * For text blocks we produce nothing (they are not clickable in the panel).
 *
 * If no proof line produced the query text line, the slot is `null`.
 */

import { parseBlocks } from './markdown'

/**
 * Build the goal-line → proof-line index.
 *
 * @param fullGoalText The rendered goal state for the whole proof (panel text).
 * @param perLineGoals Rendered goal state at end-of-line for each proof line
 *   (0-indexed). `perLineGoals[i]` is the goal text after proof line `i`.
 * @returns Array of 1-indexed proof line numbers (or null) parallel to the
 *   flattened code-block lines in `fullGoalText`.
 */
export function buildGoalLineMap(
  fullGoalText: string,
  perLineGoals: readonly string[],
): (number | null)[] {
  const blocks = parseBlocks(fullGoalText)
  const result: (number | null)[] = []

  // Precompute the set of text-lines contained in each per-line goal.
  const perLineSets: Set<string>[] = perLineGoals.map((text) => new Set(text.split('\n')))

  for (const block of blocks) {
    if (block.type !== 'code') continue
    for (const line of block.content.split('\n')) {
      // Blank lines carry no proof-line meaning — skip matching to avoid
      // spurious matches against the empty goal state that follows a finished
      // proof.
      if (line.trim() === '') {
        result.push(null)
        continue
      }
      result.push(findLastMatch(line, perLineSets))
    }
  }

  return result
}

/**
 * Return the 1-indexed proof line of the *last* per-line goal that contains
 * `target`, or `null` if none do.
 */
function findLastMatch(target: string, perLineSets: readonly Set<string>[]): number | null {
  for (let i = perLineSets.length - 1; i >= 0; i--) {
    if (perLineSets[i]?.has(target)) {
      return i + 1 // 0-indexed → 1-indexed
    }
  }
  return null
}
