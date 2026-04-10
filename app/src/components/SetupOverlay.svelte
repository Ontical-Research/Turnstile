<script lang="ts">
  interface Props {
    message: string
    progress: number
    visible: boolean
    isError: boolean
  }

  let { message, progress, visible, isError }: Props = $props()
</script>

{#if visible}
  <div class="fixed inset-0 flex flex-col items-center justify-center bg-[#282c34] z-50">
    <img src="/turnstile.svg" alt="Turnstile" class="w-16 h-16 mb-6" />
    <div class="text-[#abb2bf] text-sm mb-4">{message}</div>
    {#if !isError}
      <div class="w-64 h-1 bg-[#3e4451] rounded">
        <div
          class="h-1 bg-[#61afef] rounded transition-all duration-300"
          style="width: {progress}%"
        ></div>
      </div>
    {:else}
      <div class="text-[#e06c75] text-xs mt-2">Setup failed. Check logs and restart.</div>
    {/if}
  </div>
{/if}
