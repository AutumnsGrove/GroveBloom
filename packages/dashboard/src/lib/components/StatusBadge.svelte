<script lang="ts">
  /**
   * StatusBadge - Server state indicator
   *
   * Uses Grove's design tokens with Bloom-specific state semantics.
   * Follows the Firefly pattern: domain-specific component with shared design language.
   */
  import type { ServerState } from "$lib/api/types";
  import { cn } from "@autumnsgrove/groveengine/ui/utils";

  interface Props {
    state: ServerState;
    size?: "sm" | "md" | "lg";
    class?: string;
  }

  let { state, size = "md", class: className }: Props = $props();

  // State-specific configuration with Grove color semantics
  const stateConfig: Record<ServerState, {
    label: string;
    colorClass: string;
    bgClass: string;
    pulse: boolean;
  }> = {
    OFFLINE: {
      label: "Offline",
      colorClass: "text-cream-400",
      bgClass: "bg-cream-400/15",
      pulse: false,
    },
    PROVISIONING: {
      label: "Starting...",
      colorClass: "text-yellow-400",
      bgClass: "bg-yellow-400/15",
      pulse: true,
    },
    RUNNING: {
      label: "Running",
      colorClass: "text-grove-400",
      bgClass: "bg-grove-400/15",
      pulse: false,
    },
    IDLE: {
      label: "Idle",
      colorClass: "text-blue-400",
      bgClass: "bg-blue-400/15",
      pulse: false,
    },
    SYNCING: {
      label: "Syncing...",
      colorClass: "text-yellow-400",
      bgClass: "bg-yellow-400/15",
      pulse: true,
    },
    TERMINATING: {
      label: "Stopping...",
      colorClass: "text-orange-400",
      bgClass: "bg-orange-400/15",
      pulse: true,
    },
  };

  const config = $derived(stateConfig[state] || stateConfig.OFFLINE);

  const sizeClasses = {
    sm: "text-xs px-2 py-0.5 gap-1.5",
    md: "text-sm px-3 py-1 gap-2",
    lg: "text-base px-4 py-1.5 gap-2",
  };

  const dotSizes = {
    sm: "w-1.5 h-1.5",
    md: "w-2 h-2",
    lg: "w-2.5 h-2.5",
  };
</script>

<span
  class={cn(
    "inline-flex items-center rounded-full font-medium transition-colors",
    config.bgClass,
    config.colorClass,
    sizeClasses[size],
    className
  )}
>
  <span
    class={cn(
      "rounded-full",
      dotSizes[size],
      config.colorClass.replace("text-", "bg-"),
      config.pulse && "animate-pulse"
    )}
  ></span>
  {config.label}
</span>
