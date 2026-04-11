<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { mountEditor, type EditorHandle } from '../lib/editor'
  import type { DiagnosticInfo, SemanticToken } from '../lib/tauri'
  import type { Theme } from '../lib/theme'

  interface Props {
    initialTheme: Theme
    onchange: (content: string) => void
    oncursormove: (line: number, col: number) => void
  }

  let { initialTheme, onchange, oncursormove }: Props = $props()

  let container: HTMLDivElement
  let handle: EditorHandle | null = null

  export function applySemanticTokens(tokens: SemanticToken[]): void {
    handle?.applySemanticTokens(tokens)
  }

  export function applyDiagnostics(diagnostics: DiagnosticInfo[]): void {
    handle?.applyDiagnostics(diagnostics)
  }

  export function setTheme(t: Theme): void {
    handle?.setTheme(t)
  }

  onMount(() => {
    handle = mountEditor(container, initialTheme, onchange, oncursormove)
  })

  onDestroy(() => {
    handle?.destroy()
  })
</script>

<div bind:this={container} class="w-full h-full"></div>
