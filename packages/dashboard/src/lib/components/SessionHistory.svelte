<script lang="ts">
  import type { Session } from "$lib/api/types";

  interface Props {
    sessions: Session[];
    thisMonth?: {
      totalHours: number;
      totalCost: number;
      sessionCount: number;
    };
  }

  let { sessions, thisMonth }: Props = $props();

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  }

  function formatCost(cost: number | null): string {
    if (cost === null) return "-";
    return `$${cost.toFixed(2)}`;
  }
</script>

<div class="history">
  {#if thisMonth}
    <div class="summary">
      <span class="summary-label">This month:</span>
      <span class="summary-value">{thisMonth.totalHours.toFixed(1)} hrs</span>
      <span class="summary-sep">·</span>
      <span class="summary-value">${thisMonth.totalCost.toFixed(2)}</span>
    </div>
  {/if}

  <div class="sessions">
    {#if sessions.length === 0}
      <p class="empty">No sessions yet</p>
    {:else}
      {#each sessions as session (session.sessionId)}
        <div class="session">
          <div class="session-main">
            <span class="session-date">{formatDate(session.startedAt)}</span>
            <span class="session-duration">{session.durationFormatted}</span>
            <span class="session-cost">{formatCost(session.costUsd)}</span>
          </div>
          <div class="session-meta">
            <span class="session-region">{session.region.toUpperCase()}</span>
            {#if session.tasksCompleted > 0}
              <span class="session-tasks">{session.tasksCompleted} task{session.tasksCompleted !== 1 ? 's' : ''}</span>
            {/if}
            {#if session.shutdownReason}
              <span class="session-reason">{session.shutdownReason.replace('_', ' ')}</span>
            {/if}
          </div>
        </div>
      {/each}
    {/if}
  </div>
</div>

<style>
  .history {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .summary {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background: var(--color-surface-elevated);
    border-radius: 0.5rem;
    font-size: 0.875rem;
  }

  .summary-label {
    color: var(--color-text-muted);
  }

  .summary-value {
    font-weight: 500;
    color: var(--color-text);
  }

  .summary-sep {
    color: var(--color-text-muted);
  }

  .sessions {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .empty {
    text-align: center;
    color: var(--color-text-muted);
    padding: 2rem;
  }

  .session {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 0.75rem 1rem;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 0.5rem;
  }

  .session-main {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .session-date {
    flex: 1;
    font-weight: 500;
    color: var(--color-text);
  }

  .session-duration {
    color: var(--color-text);
    font-variant-numeric: tabular-nums;
  }

  .session-cost {
    min-width: 3.5rem;
    text-align: right;
    color: var(--color-green);
    font-variant-numeric: tabular-nums;
  }

  .session-meta {
    display: flex;
    gap: 0.75rem;
    font-size: 0.75rem;
    color: var(--color-text-muted);
  }

  .session-region {
    font-weight: 500;
  }

  @media (max-width: 480px) {
    .session-main {
      flex-wrap: wrap;
      gap: 0.5rem;
    }

    .session-date {
      width: 100%;
    }
  }
</style>
