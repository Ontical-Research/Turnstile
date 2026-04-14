/**
 * Debounced, document-driven goal state fetcher.
 *
 * On every `update(content)` the fetcher restarts a 300 ms timer. When the
 * timer fires it calls two Tauri commands in parallel:
 *
 * - `get_full_proof_goal_state` — the goal state after the whole proof
 *   (what the Goal State panel displays, independent of cursor position).
 * - `get_per_line_goal_states`  — the rendered goal state at the end of
 *   every line. Used to map panel lines back to proof lines.
 *
 * Back-to-back `update` calls with the same content are deduplicated.
 */

import { invoke } from './tauri'

const DEBOUNCE_MS = 300

export interface GoalStateResult {
  full: string
  perLine: string[]
}

export interface GoalStateFetcher {
  /** Call on every document change — internally debounces. */
  update(content: string): void
  /** Cancel any pending request. */
  destroy(): void
}

/**
 * Create a document-driven goal state fetcher.
 *
 * @param onResult Called once per debounced fire with the latest goals. On
 *   error `full` is an empty string and `perLine` is an empty array.
 */
export function createGoalStateFetcher(
  onResult: (result: GoalStateResult) => void,
): GoalStateFetcher {
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  let lastContent: string | null = null

  function update(content: string): void {
    if (content === lastContent) return
    lastContent = content

    if (timeoutId !== undefined) clearTimeout(timeoutId)

    timeoutId = setTimeout(() => {
      timeoutId = undefined
      Promise.all([
        invoke<string>('get_full_proof_goal_state'),
        invoke<string[]>('get_per_line_goal_states'),
      ])
        .then(([full, perLine]) => {
          onResult({ full, perLine })
        })
        .catch(() => {
          onResult({ full: '', perLine: [] })
        })
    }, DEBOUNCE_MS)
  }

  function destroy(): void {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId)
      timeoutId = undefined
    }
  }

  return { update, destroy }
}
