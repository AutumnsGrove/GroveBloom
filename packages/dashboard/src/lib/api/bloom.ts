/**
 * Bloom API Client
 *
 * Type-safe API wrapper for the bloom-control worker.
 */

import type {
  StatusResponse,
  StartRequest,
  StartResponse,
  StopRequest,
  StopResponse,
  TaskRequest,
  TaskResponse,
  ProjectsResponse,
  HistoryResponse,
  ConfigUpdateRequest,
  SyncResponse,
} from "./types";

const API_BASE = import.meta.env.DEV
  ? "http://localhost:8787"
  : "https://bloom.grove.place";

class BloomApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = "BloomApiError";
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }));
    throw new BloomApiError(response.status, error.message || "API request failed");
  }

  return response.json();
}

export const bloomApi = {
  /**
   * Get current session status
   */
  async getStatus(): Promise<StatusResponse> {
    return request<StatusResponse>("GET", "/api/status");
  },

  /**
   * Start a new VPS session
   */
  async start(options: StartRequest): Promise<StartResponse> {
    return request<StartResponse>("POST", "/api/start", options);
  },

  /**
   * Stop the current session
   */
  async stop(options: StopRequest = {}): Promise<StopResponse> {
    return request<StopResponse>("POST", "/api/stop", options);
  },

  /**
   * Send a task to the running agent
   */
  async sendTask(options: TaskRequest): Promise<TaskResponse> {
    return request<TaskResponse>("POST", "/api/task", options);
  },

  /**
   * Get list of configured projects
   */
  async getProjects(): Promise<ProjectsResponse> {
    return request<ProjectsResponse>("GET", "/api/projects");
  },

  /**
   * Trigger manual R2 sync
   */
  async sync(): Promise<SyncResponse> {
    return request<SyncResponse>("POST", "/api/sync");
  },

  /**
   * Get session history
   */
  async getHistory(limit = 10, offset = 0): Promise<HistoryResponse> {
    return request<HistoryResponse>("GET", `/api/history?limit=${limit}&offset=${offset}`);
  },

  /**
   * Update configuration
   */
  async updateConfig(config: ConfigUpdateRequest): Promise<{ status: string; config: Record<string, string> }> {
    return request("POST", "/api/config", config);
  },
};

export { BloomApiError };
