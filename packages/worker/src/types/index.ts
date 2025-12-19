/**
 * Type definitions for Grove Bloom Worker
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

export type TaskStatus = "pending" | "running" | "completed" | "failed";

export interface Session {
  id: number;
  session_id: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  cost_usd: number | null;
  region: Region;
  server_type: string;
  tasks_completed: number;
  shutdown_reason: ShutdownReason | null;
  tokens_used: number | null;
}

export interface ServerStateRecord {
  id: number;
  state: ServerState;
  session_id: string | null;
  vps_id: string | null;
  vps_ip: string | null;
  region: Region | null;
  started_at: string | null;
  last_heartbeat: string | null;
  last_activity: string | null;
  idle_since: string | null;
  current_task: string | null;
  dns_updated_at: string | null;
}

export interface Task {
  id: number;
  session_id: string;
  task_id: string;
  description: string | null;
  mode: string | null;
  started_at: string;
  completed_at: string | null;
  status: TaskStatus;
  tokens_used: number | null;
}

export interface Repository {
  id: number;
  name: string;
  url: string;
  branch: string;
  path: string;
  enabled: number;
  last_sync: string | null;
  created_at: string;
}

export interface StartRequest {
  region: Region;
  task?: string;
  autoShutdown: boolean;
}

export interface StopRequest {
  force: boolean;
  commitPending: boolean;
}

export interface TaskRequest {
  task: string;
  mode?: "architect" | "code" | "debug";
  autoShutdownOnComplete: boolean;
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
