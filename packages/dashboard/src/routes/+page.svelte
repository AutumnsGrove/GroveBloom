<script lang="ts">
  import { onMount } from "svelte";
  import { session } from "$lib/stores/session.svelte";
  import StatusBadge from "$lib/components/StatusBadge.svelte";
  import Terminal from "$lib/components/Terminal.svelte";
  import SessionHistory from "$lib/components/SessionHistory.svelte";
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
    <h2>Quick Task</h2>
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
        <h2>Terminal</h2>
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
    <h2>Recent Sessions</h2>
    <SessionHistory
      sessions={session.state.history?.sessions || []}
      thisMonth={session.state.history?.thisMonth}
    />
  </section>
</div>

<style>
  .page {
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
    padding-bottom: var(--space-xl);
  }

  .status-card {
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
  }

  .status-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .status-details {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  .status-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }

  .status-label {
    font-size: 0.875rem;
    color: var(--color-text-muted);
  }

  .status-value {
    font-weight: 500;
    font-variant-numeric: tabular-nums;
  }

  .status-value.cost {
    color: var(--color-green);
  }

  .status-value.task {
    font-size: 0.875rem;
    text-align: right;
    max-width: 60%;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .offline-content {
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
  }

  .region-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-sm);
  }

  .region-rate {
    font-size: 0.875rem;
    color: var(--color-text-muted);
  }

  .provisioning-content {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
    padding: var(--space-lg) 0;
  }

  .error-banner {
    padding: 0.75rem 1rem;
    background: color-mix(in srgb, var(--color-red) 15%, transparent);
    border: 1px solid var(--color-red);
    border-radius: var(--radius-md);
    color: var(--color-red);
    font-size: 0.875rem;
  }

  .task-section h2,
  .terminal-section h2,
  .history-section h2 {
    margin-bottom: var(--space-md);
    font-size: 0.875rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-text-muted);
  }

  .task-input-group {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  .task-input-group textarea {
    resize: vertical;
    min-height: 60px;
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--space-md);
  }

  .section-header h2 {
    margin-bottom: 0;
  }
</style>
