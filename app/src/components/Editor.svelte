<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { mountEditor } from '../lib/editor'
  import type { DiagnosticInfo, SemanticToken } from '../lib/tauri'
  import type { Theme } from '../lib/theme'

  interface Props {
    initialTheme: Theme
    theme: Theme
    diagnostics?: DiagnosticInfo[] | null
    semanticTokens?: SemanticToken[] | null
    onchange: (content: string) => void
    oncursormove: (line: number, col: number) => void
  }

  let {
    initialTheme,
    theme,
    diagnostics = null,
    semanticTokens = null,
    onchange,
    oncursormove,
  }: Props = $props()

  let container: HTMLDivElement
  let handle = $state<ReturnType<typeof mountEditor> | null>(null)

  $effect(() => {
    handle?.setTheme(theme)
  })

  $effect(() => {
    if (diagnostics) handle?.applyDiagnostics(diagnostics)
  })

  $effect(() => {
    if (semanticTokens) handle?.applySemanticTokens(semanticTokens)
  })

  onMount(() => {
    handle = mountEditor(container, initialTheme, onchange, oncursormove)
  })

  onDestroy(() => {
    handle?.destroy()
  })
</script>

<div bind:this={container} class="w-full h-full"></div>
