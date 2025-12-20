/**
 * API Types for Grove Bloom Dashboard
 */

export type ServerState =
  | "OFFLINE"
  | "PROVISIONING"
  | "RUNNING"
  | "IDLE"
  | "SYNCING"
  | "TERMINATING";

export type Region = "eu" | "us";

export type ShutdownReason = "manual" | "idle_timeout" | "task_complete";

export interface StatusResponse {
  state: ServerState;
  sessionId?: string;
  region?: Region;
  serverId?: string;
  serverIp?: string;
  uptime?: number;
  idleTime?: number;
  idleTimeout?: number;
  terminalUrl?: string | null;
  lastActivity?: string;
  lastHeartbeat?: string;
  currentTask?: string | null;
  costs: {
    currentSession?: number;
    hourlyRate?: number;
    thisMonth: number;
  };
}

export interface StartRequest {
  region: Region;
  task?: string;
  autoShutdown?: boolean;
}

export interface StartResponse {
  status: string;
  sessionId: string;
  region: Region;
  serverId: number;
  serverName: string;
  estimatedReadyTime: string;
}

export interface StopRequest {
  force?: boolean;
  commitPending?: boolean;
}

export interface StopResponse {
  status: string;
  message: string;
  durationSeconds: number;
  costUsd: number;
}

export interface TaskRequest {
  task: string;
  mode?: "architect" | "code" | "debug";
  autoShutdownOnComplete?: boolean;
}

export interface TaskResponse {
  taskId: string;
  status: string;
  message: string;
}

export interface Project {
  id: number;
  name: string;
  url: string;
  branch: string;
  path: string;
  enabled: boolean;
  lastSync: string | null;
}

export interface ProjectsResponse {
  projects: Project[];
}

export interface Session {
  sessionId: string;
  startedAt: string;
  endedAt: string | null;
  duration: number | null;
  durationFormatted: string;
  region: Region;
  costUsd: number | null;
  tasksCompleted: number;
  shutdownReason: ShutdownReason | null;
}

export interface HistoryResponse {
  sessions: Session[];
  thisMonth: {
    totalHours: number;
    totalCost: number;
    sessionCount: number;
  };
}

export interface ConfigUpdateRequest {
  idleTimeout?: number;
  defaultRegion?: Region;
  autoCommit?: boolean;
  models?: {
    reasoning?: string;
    vision?: string;
  };
}

export interface SyncResponse {
  status: string;
  message: string;
}
