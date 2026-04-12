import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  parseSettings,
  applySettings,
  settings,
  updateSetting,
  resetToDefaults,
} from './settings.svelte'

// Mock the tauri invoke function
vi.mock('./tauri', () => ({
  invoke: vi.fn(),
}))

describe('parseSettings theme field', () => {
  it('parses theme from raw settings', () => {
    const s = parseSettings({ theme: 'light' })
    expect(s.theme).toBe('light')
  })

  it('defaults theme to dark when missing', () => {
    const s = parseSettings({})
    expect(s.theme).toBe('dark')
  })

  it('defaults theme to dark when invalid type', () => {
    const s = parseSettings({ theme: 123 })
    expect(s.theme).toBe('dark')
  })

  it('defaults theme to dark when unrecognized value', () => {
    const s = parseSettings({ theme: 'purple' })
    expect(s.theme).toBe('dark')
  })
})

describe('updateSetting', () => {
  beforeEach(async () => {
    // Reset to known state
    applySettings(parseSettings({}))
    const { invoke } = await import('./tauri')
    vi.mocked(invoke).mockReset()
  })

  it('persists a setting to the backend on success', async () => {
    const { invoke } = await import('./tauri')
    vi.mocked(invoke).mockResolvedValueOnce(undefined)

    await updateSetting('editorFontSize', 18)
    expect(settings.editorFontSize).toBe(18)
    expect(invoke).toHaveBeenCalledWith('save_settings', {
      settings: expect.objectContaining({ editor_font_size: 18 }) as unknown,
    })
  })

  it('rolls back local state when backend save fails', async () => {
    const { invoke } = await import('./tauri')
    vi.mocked(invoke).mockRejectedValueOnce(new Error('disk full'))

    const originalSize = settings.editorFontSize
    await expect(updateSetting('editorFontSize', 20)).rejects.toThrow('disk full')
    expect(settings.editorFontSize).toBe(originalSize)
  })
})

describe('resetToDefaults', () => {
  beforeEach(async () => {
    applySettings({
      editorFontSize: 20,
      proseFontSize: 20,
      chatFontSize: 20,
      model: 'gpt-4',
      theme: 'light',
    })
    const { invoke } = await import('./tauri')
    vi.mocked(invoke).mockReset()
  })

  it('resets all settings and persists to backend', async () => {
    const { invoke } = await import('./tauri')
    vi.mocked(invoke).mockResolvedValueOnce(undefined)

    await resetToDefaults()
    expect(settings.editorFontSize).toBe(13)
    expect(settings.model).toBeNull()
    expect(settings.theme).toBe('dark')
  })

  it('rolls back when backend save fails', async () => {
    const { invoke } = await import('./tauri')
    vi.mocked(invoke).mockRejectedValueOnce(new Error('save error'))

    await expect(resetToDefaults()).rejects.toThrow('save error')
    // Should have rolled back to the values set in beforeEach
    expect(settings.editorFontSize).toBe(20)
    expect(settings.model).toBe('gpt-4')
    expect(settings.theme).toBe('light')
  })
})
