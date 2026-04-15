<script lang="ts">
  import { parseBlocks } from '../lib/markdown'
  import { highlightLean } from '../lib/leanHighlight'

  interface Props {
    goalText: string
    /**
     * Parallel to the flattened code-block lines in `goalText`. Each entry is
     * the 1-indexed Formal Proof line that would have produced that panel
     * line, or `null` if no such line exists.
     */
    goalLineToProofLine: (number | null)[]
    onHighlightLine?: (line: number | null) => void
  }

  let { goalText, goalLineToProofLine, onHighlightLine }: Props = $props()

  let highlightedFlatIdx = $state<number | null>(null)
  let blocks = $derived(parseBlocks(goalText))

  // Reset highlight whenever the goal text changes.
  let prevGoalText = ''
  $effect(() => {
    if (goalText !== prevGoalText) {
      prevGoalText = goalText
      highlightedFlatIdx = null
    }
  })

  function handleLineClick(flatIdx: number): void {
    if (highlightedFlatIdx === flatIdx) {
      highlightedFlatIdx = null
      onHighlightLine?.(null)
    } else {
      highlightedFlatIdx = flatIdx
      onHighlightLine?.(goalLineToProofLine[flatIdx] ?? null)
    }
  }

  function handleLineKeydown(e: KeyboardEvent, flatIdx: number): void {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleLineClick(flatIdx)
    }
  }

  // Compute the starting flat index for each code block so templates can
  // convert (blockIdx, localIdx) → flatIdx.
  let codeBlockOffsets = $derived.by(() => {
    const offsets: number[] = []
    let running = 0
    for (const block of blocks) {
      if (block.type === 'code') {
        offsets.push(running)
        running += block.content.split('\n').length
      } else {
        offsets.push(-1)
      }
    }
    return offsets
  })
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
          <!-- eslint-disable svelte/no-at-html-tags -- highlightLean HTML-escapes all content; only emits cm-lean-* spans -->
          <pre
            class="text-[13px] font-mono mb-2 leading-relaxed">{#each block.content.split('\n') as line, idx (idx)}{@const flatIdx =
                (codeBlockOffsets[blockIdx] ?? 0) + idx}<div
                role="button"
                tabindex="0"
                class="px-2 -mx-2 rounded cursor-pointer transition-colors
                {highlightedFlatIdx === flatIdx
                  ? 'bg-accent/20 border-l-2 border-l-accent'
                  : 'hover:bg-bg-tertiary border-l-2 border-l-transparent'}"
                onclick={() => {
                  handleLineClick(flatIdx)
                }}
                onkeydown={(e) => {
                  handleLineKeydown(e, flatIdx)
                }}>{@html highlightLean(line)}</div>{/each}</pre>
          <!-- eslint-enable svelte/no-at-html-tags -->
        {/if}
      {/each}
    {/if}
  </div>
</div>
