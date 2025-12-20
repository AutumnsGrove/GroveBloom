/**
 * Session Store
 *
 * Reactive state management for the current Bloom session.
 * Uses Svelte 5 runes for reactivity.
 */

import { bloomApi } from "$lib/api/bloom";
import type { StatusResponse, Region, HistoryResponse } from "$lib/api/types";

interface SessionState {
  status: StatusResponse | null;
  history: HistoryResponse | null;
  loading: boolean;
  error: string | null;
  polling: boolean;
}

function createSessionStore() {
  let state = $state<SessionState>({
    status: null,
    history: null,
    loading: false,
    error: null,
    polling: false,
  });

  let pollInterval: ReturnType<typeof setInterval> | null = null;

  // Derived state
  const isOnline = $derived(
    state.status?.state !== "OFFLINE" && state.status?.state !== undefined
  );

  const isRunning = $derived(
    state.status?.state === "RUNNING" || state.status?.state === "IDLE"
  );

  const canStart = $derived(
    state.status?.state === "OFFLINE" && !state.loading
  );

  const canStop = $derived(isRunning && !state.loading);

  async function fetchStatus() {
    try {
      state.status = await bloomApi.getStatus();
      state.error = null;
    } catch (e) {
      state.error = e instanceof Error ? e.message : "Failed to fetch status";
    }
  }

  async function fetchHistory() {
    try {
      state.history = await bloomApi.getHistory(10, 0);
    } catch (e) {
      console.error("Failed to fetch history:", e);
    }
  }

  function startPolling(intervalMs = 5000) {
    if (pollInterval) return;
    state.polling = true;
    fetchStatus();
    pollInterval = setInterval(fetchStatus, intervalMs);
  }

  function stopPolling() {
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
    state.polling = false;
  }

  async function start(region: Region, task?: string) {
    state.loading = true;
    state.error = null;
    try {
      await bloomApi.start({ region, task, autoShutdown: true });
      await fetchStatus();
    } catch (e) {
      state.error = e instanceof Error ? e.message : "Failed to start session";
    } finally {
      state.loading = false;
    }
  }

  async function stop(force = false) {
    state.loading = true;
    state.error = null;
    try {
      await bloomApi.stop({ force, commitPending: false });
      await fetchStatus();
      await fetchHistory();
    } catch (e) {
      state.error = e instanceof Error ? e.message : "Failed to stop session";
    } finally {
      state.loading = false;
    }
  }

  async function sendTask(task: string, mode?: "architect" | "code" | "debug") {
    state.loading = true;
    state.error = null;
    try {
      await bloomApi.sendTask({ task, mode, autoShutdownOnComplete: true });
      await fetchStatus();
    } catch (e) {
      state.error = e instanceof Error ? e.message : "Failed to send task";
    } finally {
      state.loading = false;
    }
  }

  async function sync() {
    state.loading = true;
    try {
      await bloomApi.sync();
    } catch (e) {
      state.error = e instanceof Error ? e.message : "Failed to sync";
    } finally {
      state.loading = false;
    }
  }

  return {
    get state() {
      return state;
    },
    get isOnline() {
      return isOnline;
    },
    get isRunning() {
      return isRunning;
    },
    get canStart() {
      return canStart;
    },
    get canStop() {
      return canStop;
    },
    fetchStatus,
    fetchHistory,
    startPolling,
    stopPolling,
    start,
    stop,
    sendTask,
    sync,
  };
}

export const session = createSessionStore();
