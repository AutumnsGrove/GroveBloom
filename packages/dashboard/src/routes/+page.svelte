<script lang="ts">
  /**
   * Grove Bloom Dashboard - Main Page
   *
   * Mobile-first interface for controlling the Bloom coding agent.
   * Uses Grove Engine's Prism design system with Bloom customizations.
   */
  import { onMount } from "svelte";
  import { session } from "$lib/stores/session.svelte";
  import StatusBadge from "$lib/components/StatusBadge.svelte";
  import Terminal from "$lib/components/Terminal.svelte";
  import SessionHistory from "$lib/components/SessionHistory.svelte";
  import { Button } from "@autumnsgrove/groveengine/ui";
  import type { Region } from "$lib/api/types";

  let selectedRegion: Region = $state("eu");
  let taskInput = $state("");
  let showTerminal = $state(false);

  const regionInfo: Record<Region, { label: string; rate: string }> = {
    eu: { label: "EU", rate: "~$0.0085/hr" },
    us: { label: "US", rate: "~$0.022/hr" },
  };

  function handleStart() {
    const task = taskInput.trim() || undefined;
    session.start(selectedRegion, task);
    taskInput = "";
  }

  function handleStop() {
    session.stop();
  }

  function handleSendTask() {
    if (taskInput.trim()) {
      session.sendTask(taskInput.trim());
      taskInput = "";
    }
  }

  function formatUptime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }

  function formatIdleTime(idle: number, timeout: number): string {
    const idleMin = Math.floor(idle / 60);
    const timeoutMin = Math.floor(timeout / 60);
    return `${idleMin}m / ${timeoutMin}m`;
  }

  onMount(() => {
    session.startPolling(5000);
    session.fetchHistory();

    return () => {
      session.stopPolling();
    };
  });
</script>

<div class="page">
  <!-- Status Card -->
  <section class="status-card card">
    <div class="status-header">
      {#if session.state.status}
        <StatusBadge state={session.state.status.state} size="lg" />
      {:else}
        <StatusBadge state="OFFLINE" size="lg" />
      {/if}

      {#if session.isRunning && session.state.status}
        <button class="btn btn-danger btn-sm" onclick={handleStop} disabled={session.state.loading}>
          Stop
        </button>
      {/if}
    </div>

    {#if session.isRunning && session.state.status}
      <div class="status-details">
        <div class="status-row">
          <span class="status-label">Region</span>
          <span class="status-value">{session.state.status.region?.toUpperCase()}</span>
        </div>
        <div class="status-row">
          <span class="status-label">Uptime</span>
          <span class="status-value">{formatUptime(session.state.status.uptime || 0)}</span>
        </div>
        <div class="status-row">
          <span class="status-label">Idle</span>
          <span class="status-value">
            {formatIdleTime(
              session.state.status.idleTime || 0,
              session.state.status.idleTimeout || 7200
            )}
          </span>
        </div>
        <div class="status-row">
          <span class="status-label">Cost</span>
          <span class="status-value cost">
            ${(session.state.status.costs.currentSession || 0).toFixed(3)}
          </span>
        </div>
        {#if session.state.status.currentTask}
          <div class="status-row">
            <span class="status-label">Task</span>
            <span class="status-value task">{session.state.status.currentTask}</span>
          </div>
        {/if}
      </div>
    {:else if !session.isOnline}
      <div class="offline-content">
        <!-- Region Toggle -->
        <div class="region-section">
          <div class="region-toggle">
            <button
              class:active={selectedRegion === "eu"}
              onclick={() => selectedRegion = "eu"}
            >
              EU
            </button>
            <button
              class:active={selectedRegion === "us"}
              onclick={() => selectedRegion = "us"}
            >
              US
            </button>
          </div>
          <span class="region-rate">{regionInfo[selectedRegion].rate}</span>
        </div>

        <!-- Start Button -->
        <button
          class="btn btn-primary btn-lg btn-full"
          onclick={handleStart}
          disabled={!session.canStart || session.state.loading}
        >
          {#if session.state.loading}
            Starting...
          {:else}
            🌱 Start Bloom
          {/if}
        </button>
      </div>
    {:else}
      <div class="provisioning-content">
        <p class="text-muted text-center">Server is starting up...</p>
        <p class="text-muted text-sm text-center">This usually takes 1-3 minutes</p>
      </div>
    {/if}
  </section>

  <!-- Error Display -->
  {#if session.state.error}
    <div class="error-banner">
      {session.state.error}
    </div>
  {/if}

  <!-- Task Input -->
  <section class="task-section">
    <h2 class="section-title">Quick Task</h2>
    <div class="task-input-group">
      <textarea
        bind:value={taskInput}
        placeholder={session.isRunning ? "Describe a task to run..." : "Describe a task to start with..."}
        rows="2"
      ></textarea>
      {#if session.isRunning}
        <button
          class="btn btn-primary"
          onclick={handleSendTask}
          disabled={!taskInput.trim() || session.state.loading}
        >
          Send Task
        </button>
      {/if}
    </div>
  </section>

  <!-- Terminal -->
  {#if session.isRunning}
    <section class="terminal-section">
      <div class="section-header">
        <h2 class="section-title">Terminal</h2>
        <button
          class="btn btn-sm btn-secondary"
          onclick={() => showTerminal = !showTerminal}
        >
          {showTerminal ? "Hide" : "Show"}
        </button>
      </div>
      <Terminal url={session.state.status?.terminalUrl ?? null} visible={showTerminal} />
    </section>
  {/if}

  <!-- Session History -->
  <section class="history-section">
    <h2 class="section-title">Recent Sessions</h2>
    <SessionHistory
      sessions={session.state.history?.sessions || []}
      thisMonth={session.state.history?.thisMonth}
    />
  </section>
</div>

<style>
  /* Using Tailwind classes for most styles - keeping custom vars for Bloom theme consistency */
  .page {
    @apply flex flex-col gap-6 pb-8;
  }

  .status-card {
    @apply flex flex-col gap-6;
  }

  .status-header {
    @apply flex justify-between items-center;
  }

  .status-details {
    @apply flex flex-col gap-2;
  }

  .status-row {
    @apply flex justify-between items-baseline;
  }

  .status-label {
    @apply text-sm;
    color: var(--color-text-muted);
  }

  .status-value {
    @apply font-medium tabular-nums;
  }

  .status-value.cost {
    color: var(--color-success);
  }

  .status-value.task {
    @apply text-sm text-right max-w-[60%] truncate;
  }

  .offline-content {
    @apply flex flex-col gap-6;
  }

  .region-section {
    @apply flex flex-col items-center gap-2;
  }

  .region-rate {
    @apply text-sm;
    color: var(--color-text-muted);
  }

  .provisioning-content {
    @apply flex flex-col gap-2 py-6;
  }

  .error-banner {
    @apply px-4 py-3 text-sm rounded-grove;
    background: rgba(248, 113, 113, 0.15);
    border: 1px solid var(--color-error);
    color: var(--color-error);
  }

  .section-title {
    @apply mb-4 text-sm uppercase tracking-wide;
    color: var(--color-text-muted);
  }

  .task-input-group {
    @apply flex flex-col gap-2;
  }

  .task-input-group textarea {
    @apply resize-y;
    min-height: 60px;
  }

  .section-header {
    @apply flex justify-between items-center mb-4;
  }

  .section-header h2 {
    @apply mb-0;
  }
</style>
