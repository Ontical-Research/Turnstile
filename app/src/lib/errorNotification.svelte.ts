/**
 * Lightweight error notification state for surfacing user-facing errors.
 *
 * Exposes a single reactive error message string (or null when no error is
 * active). Errors auto-dismiss after a configurable timeout.
 */

const AUTO_DISMISS_MS = 5_000

let errorMessage = $state<string | null>(null)
let dismissTimer: ReturnType<typeof setTimeout> | null = null

function clearTimer(): void {
  if (dismissTimer !== null) {
    clearTimeout(dismissTimer)
    dismissTimer = null
  }
}

/** Reactive read-only accessor for the current error message. */
export const errorNotification = {
  get message(): string | null {
    return errorMessage
  },
}

/** Show an error message. Auto-dismisses after ~5 seconds. */
export function showError(message: string): void {
  clearTimer()
  errorMessage = message
  dismissTimer = setTimeout(() => {
    errorMessage = null
    dismissTimer = null
  }, AUTO_DISMISS_MS)
}

/** Immediately dismiss the current error. */
export function dismissError(): void {
  clearTimer()
  errorMessage = null
}
