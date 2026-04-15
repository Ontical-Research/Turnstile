<script lang="ts">
  import { parseBlocks } from '../lib/markdown'
  import { lspHoverGoalPanel, type HoverInfo } from '../lib/lspRequests'
  import { computeHighlightedPanelIndices } from '../lib/editorHelpers'
  import CodeWindow from './CodeWindow.svelte'
  import type { ResolvedTheme } from '../lib/theme'

  interface Props {
    goalText: string
    /**
     * Parallel to the flattened code-block lines in `goalText`. Each entry is
     * the 1-indexed Formal Proof line that would have produced that panel
     * line, or `null` if no such line exists.
     */
    goalLineToProofLine: (number | null)[]
    theme: ResolvedTheme
    /** Current cursor line in the Formal Proof editor (0-indexed LSP). */
    cursorLine: number | null
    /** True when the Formal Proof editor has focus. */
    editorFocused: boolean
  }

  let { goalText, goalLineToProofLine, theme, cursorLine, editorFocused }: Props = $props()

  let blocks = $derived(parseBlocks(goalText))

  /**
   * For each block, precompute the starting flat index and line count so
   * template callbacks can convert (blockIdx, localLine) ↔ flatIdx without
   * re-splitting block contents on every render. Text blocks get
   * `{ start: -1, count: 0 }` as a marker.
   */
  let blockExtents = $derived.by(() => {
    const extents: { start: number; count: number }[] = []
    let running = 0
    for (const block of blocks) {
      if (block.type === 'code') {
        const count = block.content.split('\n').length
        extents.push({ start: running, count })
        running += count
      } else {
        extents.push({ start: -1, count: 0 })
      }
    }
    return extents
  })

  function flatIdxFor(blockIdx: number, localLine: number): number {
    return (blockExtents[blockIdx]?.start ?? 0) + localLine
  }

  // Reverse-lookup: which panel rows correspond to the editor's cursor line?
  // Gated on editor focus so the highlight only appears when the Formal Proof
  // editor is the active surface, matching VSCode's behavior.
  let highlightedFlatIndices = $derived(
    computeHighlightedPanelIndices(goalLineToProofLine, cursorLine, editorFocused),
  )

  /**
   * Resolve the active line (1-indexed, within the given block) for
   * CodeWindow. Returns the first matching panel row that falls inside this
   * block, or null when none does — multi-match within one block collapses
   * to the earliest row, which is enough for the common 1:1-per-block case.
   */
  function activeLineForBlock(blockIdx: number): number | null {
    const extent = blockExtents[blockIdx]
    if (!extent || extent.start < 0) return null
    for (let local = 0; local < extent.count; local++) {
      if (highlightedFlatIndices.has(extent.start + local)) return local + 1
    }
    return null
  }

  function fetchHoverFor(
    blockIdx: number,
    lspLine: number,
    character: number,
  ): Promise<HoverInfo | null> {
    return lspHoverGoalPanel(flatIdxFor(blockIdx, lspLine), character)
  }
</script>

<div class="flex flex-col h-full">
  <div class="flex-1 min-h-0 overflow-y-auto p-3">
    {#if !goalText}
      <div class="flex items-center justify-center h-full">
        <span class="text-[13px] text-text-secondary opacity-60">No goal state yet</span>
      </div>
    {:else}
      {#each blocks as block, blockIdx (blockIdx)}
        {#if block.type === 'text'}
          <p class="text-text-secondary text-[13px] mb-2 font-mono whitespace-pre-wrap">
            {block.content}
          </p>
        {:else}
          <div class="mb-2">
            <CodeWindow
              content={block.content}
              {theme}
              activeLine={activeLineForBlock(blockIdx)}
              fetchHover={(line: number, character: number) =>
                fetchHoverFor(blockIdx, line, character)}
            />
          </div>
        {/if}
      {/each}
    {/if}
  </div>
</div>
