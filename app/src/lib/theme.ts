import { writable } from 'svelte/store'

export type Theme = 'dark' | 'light'

export const theme = writable<Theme>('dark')

export function toggleTheme(current: Theme): Theme {
  return current === 'dark' ? 'light' : 'dark'
}
