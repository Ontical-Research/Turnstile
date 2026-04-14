import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createGoalStateFetcher } from './goalState'

function mockTauri(): { core: { invoke: ReturnType<typeof vi.fn> } } {
  const mock = {
    core: { invoke: vi.fn() },
    event: { listen: vi.fn() },
  }
  Object.defineProperty(globalThis, 'window', {
    value: { __TAURI__: mock },
    writable: true,
    configurable: true,
  })
  return mock
}

describe('createGoalStateFetcher', () => {
  let tauri: ReturnType<typeof mockTauri>
  let onResult: ReturnType<typeof vi.fn<(goalText: string, line: number, col: number) => void>>

  beforeEach(() => {
    vi.useFakeTimers()
    tauri = mockTauri()
    onResult = vi.fn<(goalText: string, line: number, col: number) => void>()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('debounces rapid calls into a single invocation', async () => {
    tauri.core.invoke.mockResolvedValue('goal 1')
    const fetcher = createGoalStateFetcher(onResult)

    fetcher.update(0, 0)
    fetcher.update(1, 0)
    fetcher.update(2, 5)

    // Only one timeout should be pending
    await vi.advanceTimersByTimeAsync(300)

    expect(tauri.core.invoke).toHaveBeenCalledTimes(1)
    expect(tauri.core.invoke).toHaveBeenCalledWith('get_goal_state', { line: 2, col: 5 })
    expect(onResult).toHaveBeenCalledWith('goal 1', 2, 5)

    fetcher.destroy()
  })

  it('deduplicates calls with the same line and col', async () => {
    tauri.core.invoke.mockResolvedValue('goal')
    const fetcher = createGoalStateFetcher(onResult)

    fetcher.update(3, 2)
    await vi.advanceTimersByTimeAsync(300)

    fetcher.update(3, 2) // same position
    await vi.advanceTimersByTimeAsync(300)

    expect(tauri.core.invoke).toHaveBeenCalledTimes(1)

    fetcher.destroy()
  })

  it('calls onResult with empty string on error', async () => {
    tauri.core.invoke.mockRejectedValue(new Error('LSP not connected'))
    const fetcher = createGoalStateFetcher(onResult)

    fetcher.update(0, 0)
    await vi.advanceTimersByTimeAsync(300)

    expect(onResult).toHaveBeenCalledWith('', 0, 0)

    fetcher.destroy()
  })

  it('destroy cancels pending request', async () => {
    tauri.core.invoke.mockResolvedValue('goal')
    const fetcher = createGoalStateFetcher(onResult)

    fetcher.update(1, 0)
    fetcher.destroy()

    await vi.advanceTimersByTimeAsync(300)

    expect(tauri.core.invoke).not.toHaveBeenCalled()
    expect(onResult).not.toHaveBeenCalled()
  })

  it('fires again after position changes from a deduplicated position', async () => {
    tauri.core.invoke.mockResolvedValue('goal A')
    const fetcher = createGoalStateFetcher(onResult)

    fetcher.update(1, 0)
    await vi.advanceTimersByTimeAsync(300)
    expect(tauri.core.invoke).toHaveBeenCalledTimes(1)

    // Move to a different position
    tauri.core.invoke.mockResolvedValue('goal B')
    fetcher.update(2, 0)
    await vi.advanceTimersByTimeAsync(300)
    expect(tauri.core.invoke).toHaveBeenCalledTimes(2)

    // Move back to original
    tauri.core.invoke.mockResolvedValue('goal A again')
    fetcher.update(1, 0)
    await vi.advanceTimersByTimeAsync(300)
    expect(tauri.core.invoke).toHaveBeenCalledTimes(3)

    fetcher.destroy()
  })
})
