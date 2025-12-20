<script lang="ts">
  import type { ServerState } from "$lib/api/types";

  interface Props {
    state: ServerState;
    size?: "sm" | "md" | "lg";
  }

  let { state, size = "md" }: Props = $props();

  const stateConfig: Record<ServerState, { label: string; color: string; pulse: boolean }> = {
    OFFLINE: { label: "Offline", color: "var(--color-gray)", pulse: false },
    PROVISIONING: { label: "Starting...", color: "var(--color-yellow)", pulse: true },
    RUNNING: { label: "Running", color: "var(--color-green)", pulse: false },
    IDLE: { label: "Idle", color: "var(--color-blue)", pulse: false },
    SYNCING: { label: "Syncing...", color: "var(--color-yellow)", pulse: true },
    TERMINATING: { label: "Stopping...", color: "var(--color-orange)", pulse: true },
  };

  const config = $derived(stateConfig[state] || stateConfig.OFFLINE);
</script>

<span class="badge {size}" class:pulse={config.pulse} style="--badge-color: {config.color}">
  <span class="dot"></span>
  {config.label}
</span>

<style>
  .badge {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.25rem 0.75rem;
    border-radius: 9999px;
    background: color-mix(in srgb, var(--badge-color) 15%, transparent);
    color: var(--badge-color);
    font-weight: 500;
  }

  .badge.sm {
    font-size: 0.75rem;
    padding: 0.125rem 0.5rem;
    gap: 0.375rem;
  }

  .badge.md {
    font-size: 0.875rem;
  }

  .badge.lg {
    font-size: 1rem;
    padding: 0.375rem 1rem;
  }

  .dot {
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 50%;
    background: var(--badge-color);
  }

  .pulse .dot {
    animation: pulse 1.5s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.4;
    }
  }
</style>
