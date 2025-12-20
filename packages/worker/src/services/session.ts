/**
 * Session Service
 *
 * D1 database operations for server state, sessions, tasks, and config.
 */

import type {
  ServerState,
  ServerStateRecord,
  Session,
  Task,
  TaskStatus,
  Region,
  ShutdownReason,
  Repository,
} from "../types";

export interface SessionService {
  // Server state (singleton row)
  getServerState(): Promise<ServerStateRecord | null>;
  updateServerState(updates: Partial<ServerStateRecord>): Promise<void>;
  resetServerState(): Promise<void>;

  // Sessions
  createSession(data: {
    sessionId: string;
    region: Region;
    serverType: string;
  }): Promise<void>;
  endSession(
    sessionId: string,
    data: {
      durationSeconds: number;
      costUsd: number;
      shutdownReason: ShutdownReason;
      tasksCompleted: number;
    }
  ): Promise<void>;
  getSession(sessionId: string): Promise<Session | null>;
  getSessions(limit: number, offset: number): Promise<Session[]>;
  getMonthlySummary(month: string): Promise<{
    totalHours: number;
    totalCost: number;
    sessionCount: number;
    tasksCompleted: number;
  }>;

  // Tasks
  createTask(data: {
    sessionId: string;
    taskId: string;
    description: string;
    mode?: string;
  }): Promise<void>;
  updateTask(
    taskId: string,
    updates: { status?: TaskStatus; completedAt?: string; tokensUsed?: number }
  ): Promise<void>;
  getSessionTasks(sessionId: string): Promise<Task[]>;

  // Config
  getConfig(key: string): Promise<string | null>;
  setConfig(key: string, value: string): Promise<void>;
  getAllConfig(): Promise<Record<string, string>>;

  // Repositories
  getRepositories(): Promise<Repository[]>;
  addRepository(data: {
    name: string;
    url: string;
    branch: string;
    path: string;
  }): Promise<void>;
  updateRepository(
    id: number,
    updates: { enabled?: number; lastSync?: string }
  ): Promise<void>;
  deleteRepository(id: number): Promise<void>;
}

export function createSessionService(db: D1Database): SessionService {
  return {
    // Server state operations
    async getServerState() {
      const result = await db
        .prepare("SELECT * FROM server_state WHERE id = 1")
        .first<ServerStateRecord>();
      return result;
    },

    async updateServerState(updates: Partial<ServerStateRecord>) {
      // Ensure a row exists
      await db
        .prepare(
          `INSERT OR IGNORE INTO server_state (id, state) VALUES (1, 'OFFLINE')`
        )
        .run();

      const setClauses: string[] = [];
      const values: unknown[] = [];

      for (const [key, value] of Object.entries(updates)) {
        if (key !== "id" && value !== undefined) {
          setClauses.push(`${key} = ?`);
          values.push(value);
        }
      }

      if (setClauses.length > 0) {
        await db
          .prepare(`UPDATE server_state SET ${setClauses.join(", ")} WHERE id = 1`)
          .bind(...values)
          .run();
      }
    },

    async resetServerState() {
      await db
        .prepare(
          `UPDATE server_state SET
            state = 'OFFLINE',
            session_id = NULL,
            vps_id = NULL,
            vps_ip = NULL,
            region = NULL,
            started_at = NULL,
            last_heartbeat = NULL,
            last_activity = NULL,
            idle_since = NULL,
            current_task = NULL,
            dns_updated_at = NULL
          WHERE id = 1`
        )
        .run();
    },

    // Session operations
    async createSession(data) {
      const now = new Date().toISOString();
      await db
        .prepare(
          `INSERT INTO sessions (session_id, started_at, region, server_type)
           VALUES (?, ?, ?, ?)`
        )
        .bind(data.sessionId, now, data.region, data.serverType)
        .run();
    },

    async endSession(sessionId, data) {
      const now = new Date().toISOString();
      await db
        .prepare(
          `UPDATE sessions SET
            ended_at = ?,
            duration_seconds = ?,
            cost_usd = ?,
            shutdown_reason = ?,
            tasks_completed = ?
          WHERE session_id = ?`
        )
        .bind(
          now,
          data.durationSeconds,
          data.costUsd,
          data.shutdownReason,
          data.tasksCompleted,
          sessionId
        )
        .run();

      // Update monthly summary
      const month = now.substring(0, 7); // "2025-01"
      const hours = data.durationSeconds / 3600;

      await db
        .prepare(
          `INSERT INTO monthly_summary (month, total_hours, total_cost, session_count, tasks_completed)
           VALUES (?, ?, ?, 1, ?)
           ON CONFLICT(month) DO UPDATE SET
             total_hours = total_hours + excluded.total_hours,
             total_cost = total_cost + excluded.total_cost,
             session_count = session_count + 1,
             tasks_completed = tasks_completed + excluded.tasks_completed`
        )
        .bind(month, hours, data.costUsd, data.tasksCompleted)
        .run();
    },

    async getSession(sessionId) {
      return db
        .prepare("SELECT * FROM sessions WHERE session_id = ?")
        .bind(sessionId)
        .first<Session>();
    },

    async getSessions(limit, offset) {
      const results = await db
        .prepare(
          "SELECT * FROM sessions ORDER BY started_at DESC LIMIT ? OFFSET ?"
        )
        .bind(limit, offset)
        .all<Session>();
      return results.results;
    },

    async getMonthlySummary(month) {
      const result = await db
        .prepare("SELECT * FROM monthly_summary WHERE month = ?")
        .bind(month)
        .first<{
          total_hours: number;
          total_cost: number;
          session_count: number;
          tasks_completed: number;
        }>();

      if (!result) {
        return {
          totalHours: 0,
          totalCost: 0,
          sessionCount: 0,
          tasksCompleted: 0,
        };
      }

      return {
        totalHours: result.total_hours,
        totalCost: result.total_cost,
        sessionCount: result.session_count,
        tasksCompleted: result.tasks_completed,
      };
    },

    // Task operations
    async createTask(data) {
      const now = new Date().toISOString();
      await db
        .prepare(
          `INSERT INTO tasks (session_id, task_id, description, mode, started_at, status)
           VALUES (?, ?, ?, ?, ?, 'pending')`
        )
        .bind(data.sessionId, data.taskId, data.description, data.mode || null, now)
        .run();
    },

    async updateTask(taskId, updates) {
      const setClauses: string[] = [];
      const values: unknown[] = [];

      if (updates.status !== undefined) {
        setClauses.push("status = ?");
        values.push(updates.status);
      }
      if (updates.completedAt !== undefined) {
        setClauses.push("completed_at = ?");
        values.push(updates.completedAt);
      }
      if (updates.tokensUsed !== undefined) {
        setClauses.push("tokens_used = ?");
        values.push(updates.tokensUsed);
      }

      if (setClauses.length > 0) {
        values.push(taskId);
        await db
          .prepare(`UPDATE tasks SET ${setClauses.join(", ")} WHERE task_id = ?`)
          .bind(...values)
          .run();
      }
    },

    async getSessionTasks(sessionId) {
      const results = await db
        .prepare("SELECT * FROM tasks WHERE session_id = ? ORDER BY started_at")
        .bind(sessionId)
        .all<Task>();
      return results.results;
    },

    // Config operations
    async getConfig(key) {
      const result = await db
        .prepare("SELECT value FROM config WHERE key = ?")
        .bind(key)
        .first<{ value: string }>();
      return result?.value ?? null;
    },

    async setConfig(key, value) {
      const now = new Date().toISOString();
      await db
        .prepare(
          `INSERT INTO config (key, value, updated_at) VALUES (?, ?, ?)
           ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
        )
        .bind(key, value, now)
        .run();
    },

    async getAllConfig() {
      const results = await db
        .prepare("SELECT key, value FROM config")
        .all<{ key: string; value: string }>();
      const config: Record<string, string> = {};
      for (const row of results.results) {
        config[row.key] = row.value;
      }
      return config;
    },

    // Repository operations
    async getRepositories() {
      const results = await db
        .prepare("SELECT * FROM repositories ORDER BY name")
        .all<Repository>();
      return results.results;
    },

    async addRepository(data) {
      const now = new Date().toISOString();
      await db
        .prepare(
          `INSERT INTO repositories (name, url, branch, path, created_at)
           VALUES (?, ?, ?, ?, ?)`
        )
        .bind(data.name, data.url, data.branch, data.path, now)
        .run();
    },

    async updateRepository(id, updates) {
      const setClauses: string[] = [];
      const values: unknown[] = [];

      if (updates.enabled !== undefined) {
        setClauses.push("enabled = ?");
        values.push(updates.enabled);
      }
      if (updates.lastSync !== undefined) {
        setClauses.push("last_sync = ?");
        values.push(updates.lastSync);
      }

      if (setClauses.length > 0) {
        values.push(id);
        await db
          .prepare(`UPDATE repositories SET ${setClauses.join(", ")} WHERE id = ?`)
          .bind(...values)
          .run();
      }
    },

    async deleteRepository(id) {
      await db.prepare("DELETE FROM repositories WHERE id = ?").bind(id).run();
    },
  };
}
