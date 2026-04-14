<script lang="ts">
  import { parseBlocks } from '../lib/markdown'

  interface Props {
    goalText: string
    cursorLine: number
    onHighlightLine?: (line: number | null) => void
  }

  let { goalText, cursorLine, onHighlightLine }: Props = $props()

  let highlightedIdx = $state<number | null>(null)
  let blocks = $derived(parseBlocks(goalText))

  // Reset highlight when goal text changes (new cursor position)
  let prevGoalText = ''
  $effect(() => {
    if (goalText !== prevGoalText) {
      prevGoalText = goalText
      highlightedIdx = null
    }
  })

  function handleLineClick(idx: number): void {
    if (highlightedIdx === idx) {
      highlightedIdx = null
      onHighlightLine?.(null)
    } else {
      highlightedIdx = idx
      onHighlightLine?.(cursorLine)
    }
  }

  function handleLineKeydown(e: KeyboardEvent, idx: number): void {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleLineClick(idx)
    }
  }
</script>

<div class="flex flex-col h-full">
  <div class="flex items-center px-4 py-2 border-b border-border bg-bg-secondary shrink-0">
    <span class="text-[13px] font-semibold text-text-primary tracking-wide uppercase opacity-70">
      Goal State
    </span>
  </div>

  <div class="flex-1 min-h-0 overflow-y-auto p-3">
    {#if !goalText}
      <div class="flex items-center justify-center h-full">
        <span class="text-[13px] text-text-secondary opacity-60">
          Move cursor to a tactic to see the goal state
        </span>
      </div>
    {:else}
      {#each blocks as block, blockIdx (blockIdx)}
        {#if block.type === 'text'}
          <p class="text-text-secondary text-[13px] mb-2 font-mono whitespace-pre-wrap">
            {block.content}
          </p>
        {:else}
          <pre
            class="text-[13px] font-mono mb-2 leading-relaxed">{#each block.content.split('\n') as line, idx (idx)}<div
                role="button"
                tabindex="0"
                class="px-2 -mx-2 rounded cursor-pointer transition-colors
                {highlightedIdx === idx
                  ? 'bg-accent/20 border-l-2 border-l-accent'
                  : 'hover:bg-bg-tertiary border-l-2 border-l-transparent'}"
                onclick={() => {
                  handleLineClick(idx)
                }}
                onkeydown={(e) => {
                  handleLineKeydown(e, idx)
                }}>{line}</div>{/each}</pre>
        {/if}
      {/each}
    {/if}
  </div>
</div>
