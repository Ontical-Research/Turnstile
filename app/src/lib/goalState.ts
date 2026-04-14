/**
 * Debounced goal state fetcher.
 *
 * Wraps the Tauri `get_goal_state` command with 300ms debouncing and
 * deduplication so rapid cursor movements produce at most one LSP request.
 */

import { invoke } from './tauri'

const DEBOUNCE_MS = 300

export interface GoalStateFetcher {
  /** Call on every cursor move — internally debounces. */
  update(line: number, col: number): void
  /** Cancel any pending request. */
  destroy(): void
}

/**
 * Create a goal state fetcher that debounces LSP requests.
 *
 * @param onResult Called with the rendered goal text plus the (line, col) that
 *   produced it. On error the text is empty.
 */
export function createGoalStateFetcher(
  onResult: (goalText: string, line: number, col: number) => void,
): GoalStateFetcher {
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  let lastLine = -1
  let lastCol = -1

  function update(line: number, col: number): void {
    if (line === lastLine && col === lastCol) return
    lastLine = line
    lastCol = col

    if (timeoutId !== undefined) clearTimeout(timeoutId)

    timeoutId = setTimeout(() => {
      timeoutId = undefined
      invoke<string>('get_goal_state', { line, col })
        .then((text) => {
          onResult(text, line, col)
        })
        .catch(() => {
          onResult('', line, col)
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
