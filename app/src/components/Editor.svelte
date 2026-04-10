<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { mountEditor, type EditorHandle } from '../lib/editor'
  import type { DiagnosticInfo, SemanticToken } from '../lib/tauri'

  interface Props {
    onchange: (content: string) => void
    oncursormove: (line: number, col: number) => void
  }

  let { onchange, oncursormove }: Props = $props()

  let container: HTMLDivElement
  let handle: EditorHandle | null = null

  export function applySemanticTokens(tokens: SemanticToken[]) {
    handle?.applySemanticTokens(tokens)
  }

  export function applyDiagnostics(diagnostics: DiagnosticInfo[]) {
    handle?.applyDiagnostics(diagnostics)
  }

  onMount(() => {
    handle = mountEditor(container, onchange, oncursormove)
  })

  onDestroy(() => {
    handle?.destroy()
  })
</script>

<div bind:this={container} class="w-full h-full"></div>
