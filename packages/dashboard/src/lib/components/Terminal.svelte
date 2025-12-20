<script lang="ts">
  interface Props {
    url: string | null;
    visible?: boolean;
  }

  let { url, visible = true }: Props = $props();
</script>

{#if visible && url}
  <div class="terminal-container">
    <div class="terminal-header">
      <span class="terminal-title">Terminal</span>
      <a href={url} target="_blank" rel="noopener" class="terminal-link">
        Open in new tab
      </a>
    </div>
    <iframe
      src={url}
      title="Bloom Terminal"
      class="terminal-frame"
      allow="clipboard-read; clipboard-write"
    ></iframe>
  </div>
{:else if visible}
  <div class="terminal-placeholder">
    <p>Terminal will appear when server is running</p>
  </div>
{/if}

<style>
  .terminal-container {
    display: flex;
    flex-direction: column;
    border-radius: 0.5rem;
    overflow: hidden;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
  }

  .terminal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 1rem;
    background: var(--color-surface-elevated);
    border-bottom: 1px solid var(--color-border);
  }

  .terminal-title {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--color-text-muted);
  }

  .terminal-link {
    font-size: 0.75rem;
    color: var(--color-primary);
    text-decoration: none;
  }

  .terminal-link:hover {
    text-decoration: underline;
  }

  .terminal-frame {
    width: 100%;
    min-height: 400px;
    height: 50vh;
    border: none;
    background: #1a1b26;
  }

  .terminal-placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 200px;
    background: var(--color-surface);
    border: 1px dashed var(--color-border);
    border-radius: 0.5rem;
    color: var(--color-text-muted);
  }

  @media (max-width: 640px) {
    .terminal-frame {
      min-height: 300px;
      height: 40vh;
    }
  }
</style>
