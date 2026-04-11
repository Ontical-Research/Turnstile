<script lang="ts">
  import { parseBlocks } from '../lib/markdown'

  interface Props {
    goal: string
    visible: boolean
  }

  let { goal, visible }: Props = $props()

  let blocks = $derived(parseBlocks(goal))
</script>

{#if visible}
  <div
    class="fixed bottom-0 right-0 w-96 max-h-64 overflow-auto bg-[#21222c] border-t border-l border-[#44475a] p-3 font-mono text-sm text-[#f8f8f2] z-10"
  >
    <div class="text-xs text-[#6272a4] mb-1 uppercase tracking-wide">Goal State</div>
    {#each blocks as block, i (i)}
      {#if block.type === 'code'}
        <pre class="whitespace-pre-wrap">{block.content}</pre>
      {:else}
        <p class="whitespace-pre-wrap text-[#6272a4] text-xs mb-1">{block.content}</p>
      {/if}
    {/each}
  </div>
{/if}
