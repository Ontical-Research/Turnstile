import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { errorNotification, showError, dismissError } from './errorNotification.svelte'

describe('errorNotification', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    dismissError()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts with null message', () => {
    expect(errorNotification.message).toBeNull()
  })

  it('shows an error message', () => {
    showError('Something went wrong')
    expect(errorNotification.message).toBe('Something went wrong')
  })

  it('auto-dismisses after 5 seconds', () => {
    showError('Temporary error')
    expect(errorNotification.message).toBe('Temporary error')

    vi.advanceTimersByTime(5_000)
    expect(errorNotification.message).toBeNull()
  })

  it('replaces a previous error and resets the timer', () => {
    showError('First error')
    vi.advanceTimersByTime(3_000)
    showError('Second error')

    expect(errorNotification.message).toBe('Second error')

    // The first timer (2s remaining) should NOT fire
    vi.advanceTimersByTime(3_000)
    expect(errorNotification.message).toBe('Second error')

    // The new timer fires at 5s
    vi.advanceTimersByTime(2_000)
    expect(errorNotification.message).toBeNull()
  })

  it('dismissError clears the message immediately', () => {
    showError('Error to dismiss')
    dismissError()
    expect(errorNotification.message).toBeNull()
  })

  it('dismissError cancels the auto-dismiss timer', () => {
    showError('Error to dismiss')
    dismissError()

    // Even after 5s, message stays null (timer was cancelled)
    vi.advanceTimersByTime(5_000)
    expect(errorNotification.message).toBeNull()
  })
})
