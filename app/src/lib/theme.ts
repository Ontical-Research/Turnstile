import { writable } from 'svelte/store'

export type Theme = 'dracula' | 'light'

export const theme = writable<Theme>('dracula')

export function toggleTheme(current: Theme): Theme {
  return current === 'dracula' ? 'light' : 'dracula'
}
