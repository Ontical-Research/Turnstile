import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createGoalStateFetcher } from './goalState'
import type { GoalStateResult } from './goalState'

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

function mockInvokeResponses(
  invoke: ReturnType<typeof vi.fn>,
  full: string,
  perLine: string[],
): void {
  // Return different values depending on which command is invoked.
  // eslint-disable-next-line @typescript-eslint/no-misused-promises -- Mock impl: we intentionally return a Promise from a sync-typed slot.
  invoke.mockImplementation((cmd: string) => {
    if (cmd === 'get_full_proof_goal_state') return Promise.resolve(full)
    if (cmd === 'get_per_line_goal_states') return Promise.resolve(perLine)
    return Promise.resolve(null)
  })
}

describe('createGoalStateFetcher', () => {
  let tauri: ReturnType<typeof mockTauri>
  let onResult: ReturnType<typeof vi.fn<(result: GoalStateResult) => void>>

  beforeEach(() => {
    vi.useFakeTimers()
    tauri = mockTauri()
    onResult = vi.fn<(result: GoalStateResult) => void>()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('debounces rapid calls into a single invocation', async () => {
    mockInvokeResponses(tauri.core.invoke, 'full goal', ['l0', 'l1', 'l2'])
    const fetcher = createGoalStateFetcher(onResult)

    fetcher.update('content v1')
    fetcher.update('content v2')
    fetcher.update('content v3')

    await vi.advanceTimersByTimeAsync(300)

    // Two commands invoked once each (full + per-line).
    expect(tauri.core.invoke).toHaveBeenCalledTimes(2)
    const cmds = tauri.core.invoke.mock.calls.map((c: unknown[]) => c[0] as string)
    expect(cmds).toContain('get_full_proof_goal_state')
    expect(cmds).toContain('get_per_line_goal_states')
    expect(onResult).toHaveBeenCalledTimes(1)
    expect(onResult).toHaveBeenCalledWith({ full: 'full goal', perLine: ['l0', 'l1', 'l2'] })

    fetcher.destroy()
  })

  it('deduplicates calls with identical content', async () => {
    mockInvokeResponses(tauri.core.invoke, 'g', [])
    const fetcher = createGoalStateFetcher(onResult)

    fetcher.update('same')
    await vi.advanceTimersByTimeAsync(300)

    fetcher.update('same')
    await vi.advanceTimersByTimeAsync(300)

    expect(onResult).toHaveBeenCalledTimes(1)

    fetcher.destroy()
  })

  it('calls onResult with empty result on error', async () => {
    tauri.core.invoke.mockRejectedValue(new Error('LSP not connected'))
    const fetcher = createGoalStateFetcher(onResult)

    fetcher.update('some content')
    await vi.advanceTimersByTimeAsync(300)

    expect(onResult).toHaveBeenCalledWith({ full: '', perLine: [] })

    fetcher.destroy()
  })

  it('destroy cancels pending request', async () => {
    mockInvokeResponses(tauri.core.invoke, 'g', [])
    const fetcher = createGoalStateFetcher(onResult)

    fetcher.update('content')
    fetcher.destroy()

    await vi.advanceTimersByTimeAsync(300)

    expect(tauri.core.invoke).not.toHaveBeenCalled()
    expect(onResult).not.toHaveBeenCalled()
  })

  it('fires again when content changes back to a previous value', async () => {
    mockInvokeResponses(tauri.core.invoke, 'A', ['a'])
    const fetcher = createGoalStateFetcher(onResult)

    fetcher.update('v1')
    await vi.advanceTimersByTimeAsync(300)
    expect(onResult).toHaveBeenCalledTimes(1)

    fetcher.update('v2')
    await vi.advanceTimersByTimeAsync(300)
    expect(onResult).toHaveBeenCalledTimes(2)

    // Back to v1 — fires again (we only dedupe against the most recent content).
    fetcher.update('v1')
    await vi.advanceTimersByTimeAsync(300)
    expect(onResult).toHaveBeenCalledTimes(3)

    fetcher.destroy()
  })
})
