/**
 * Grove Bloom Control Worker
 *
 * Orchestrates Hetzner VPS provisioning, R2 sync, D1 state tracking,
 * and webhook handling for the Bloom infrastructure.
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import {
  createHetznerService,
  createDnsService,
  createSessionService,
  createVpsService,
  createSongbirdService,
  createThresholdService,
  getHourlyRate,
} from "./services";
import type { SongbirdService, ThresholdService } from "./services";
import type {
  StartRequest,
  StopRequest,
  TaskRequest,
  ConfigUpdateRequest,
  ServerState,
  Region,
} from "./types";

type Bindings = {
  BLOOM_REPOS: R2Bucket;
  BLOOM_STATE: R2Bucket;
  DB: D1Database;
  RATE_LIMIT: KVNamespace;
  HETZNER_API_TOKEN: string;
  HETZNER_SSH_KEY_ID: string;
  CLOUDFLARE_API_TOKEN: string;
  CLOUDFLARE_ZONE_ID: string;
  CLOUDFLARE_ACCOUNT_ID: string;
  R2_ACCESS_KEY: string;
  R2_SECRET_KEY: string;
  OPENROUTER_API_KEY: string;
  WEBHOOK_SECRET: string;
  HEARTWOOD_CLIENT_ID: string;
  HEARTWOOD_CLIENT_SECRET: string;
  WORKER_ENV: string;
  DEFAULT_REGION: string;
  DEFAULT_IDLE_TIMEOUT: string;
};

type Variables = {
  sessionService: ReturnType<typeof createSessionService>;
  hetznerService: ReturnType<typeof createHetznerService>;
  dnsService: ReturnType<typeof createDnsService>;
  vpsService: ReturnType<typeof createVpsService>;
  songbird: SongbirdService;
  threshold: ThresholdService;
};

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Middleware: CORS for dashboard
app.use(
  "/*",
  cors({
    origin: ["https://bloom.grove.place", "http://localhost:5173"],
    credentials: true,
  })
);

// Middleware: Initialize services
app.use("/*", async (c, next) => {
  c.set("sessionService", createSessionService(c.env.DB));
  c.set("hetznerService", createHetznerService(c.env.HETZNER_API_TOKEN));
  c.set("dnsService", createDnsService(c.env.CLOUDFLARE_API_TOKEN, c.env.CLOUDFLARE_ZONE_ID));
  c.set("vpsService", createVpsService());
  // Security services (Songbird + Threshold)
  c.set("songbird", createSongbirdService());
  c.set("threshold", createThresholdService(c.env.RATE_LIMIT || null));
  await next();
});

// Helper: Generate session ID
function generateSessionId(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const random = Math.random().toString(36).substring(2, 8);
  return `bloom-${date}-${random}`;
}

// Helper: Generate task ID
function generateTaskId(): string {
  return `task-${Math.random().toString(36).substring(2, 10)}`;
}

// Helper: Verify webhook secret
function verifyWebhookSecret(c: { req: { header: (name: string) => string | undefined }; env: Bindings }): boolean {
  const auth = c.req.header("Authorization");
  if (!auth) return false;
  const token = auth.replace("Bearer ", "");
  return token === c.env.WEBHOOK_SECRET;
}

// Health check
app.get("/", (c) => {
  return c.json({
    service: "bloom-control",
    version: "0.1.0",
    status: "online",
  });
});

// ============================================================================
// API Routes
// ============================================================================

/**
 * POST /api/start - Provision a new VPS session
 *
 * Protected by:
 * - Threshold: Rate limiting (2 per hour) + cost protection
 */
app.post("/api/start", async (c) => {
  const sessionService = c.get("sessionService");
  const hetznerService = c.get("hetznerService");
  const threshold = c.get("threshold");

  // Rate limiting (Threshold pattern - strict for expensive operations)
  const identifier = c.req.header("CF-Connecting-IP") ||
                     c.req.header("X-Forwarded-For")?.split(",")[0] ||
                     "anonymous";
  const rateLimit = await threshold.checkRateLimit("api/start", identifier);
  if (!rateLimit.allowed) {
    throw new HTTPException(429, { message: rateLimit.message || "Rate limit exceeded" });
  }

  // Cost protection - estimate minimum 1 hour session (~$0.02)
  const costCheck = await threshold.checkCostLimit(identifier, 0.02);
  if (!costCheck.allowed) {
    throw new HTTPException(402, { message: costCheck.message || "Daily cost limit exceeded" });
  }

  await threshold.recordRequest("api/start", identifier);

  // Check if already running
  const state = await sessionService.getServerState();
  if (state && state.state !== "OFFLINE") {
    throw new HTTPException(409, {
      message: `Server is already ${state.state.toLowerCase()}`,
    });
  }

  const body = await c.req.json<StartRequest>();
  const region: Region = body.region || (c.env.DEFAULT_REGION as Region) || "eu";
  const idleTimeout = parseInt(c.env.DEFAULT_IDLE_TIMEOUT) || 7200;

  const sessionId = generateSessionId();
  const webhookUrl = `https://bloom.grove.place`;

  // Update state to PROVISIONING
  await sessionService.updateServerState({
    state: "PROVISIONING" as ServerState,
    session_id: sessionId,
    region,
    started_at: new Date().toISOString(),
  });

  // Create session record
  await sessionService.createSession({
    sessionId,
    region,
    serverType: region === "eu" ? "cx32" : "cpx31",
  });

  // Provision VPS
  try {
    const { serverId, serverName } = await hetznerService.createServer({
      region,
      sessionId,
      sshKeyId: c.env.HETZNER_SSH_KEY_ID,
      webhookUrl,
      webhookSecret: c.env.WEBHOOK_SECRET,
      idleTimeout,
      r2AccessKey: c.env.R2_ACCESS_KEY,
      r2SecretKey: c.env.R2_SECRET_KEY,
      cfAccountId: c.env.CLOUDFLARE_ACCOUNT_ID,
      openrouterApiKey: c.env.OPENROUTER_API_KEY,
    });

    await sessionService.updateServerState({
      vps_id: serverId.toString(),
    });

    // If there's an initial task, create a task record
    if (body.task) {
      const taskId = generateTaskId();
      await sessionService.createTask({
        sessionId,
        taskId,
        description: body.task,
      });
      await sessionService.updateServerState({
        current_task: body.task,
      });
    }

    return c.json({
      status: "provisioning",
      sessionId,
      region,
      serverId,
      serverName,
      estimatedReadyTime: new Date(Date.now() + 3 * 60 * 1000).toISOString(),
    });
  } catch (error) {
    // Reset state on failure
    await sessionService.resetServerState();
    throw new HTTPException(500, {
      message: `Failed to provision VPS: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }
});

/**
 * POST /api/stop - Stop the current session
 */
app.post("/api/stop", async (c) => {
  const sessionService = c.get("sessionService");
  const hetznerService = c.get("hetznerService");
  const vpsService = c.get("vpsService");

  const state = await sessionService.getServerState();
  if (!state || state.state === "OFFLINE") {
    throw new HTTPException(400, { message: "Server is not running" });
  }

  const body = await c.req.json<StopRequest>();

  // Update state to SYNCING (unless force stop)
  if (!body.force && state.vps_ip) {
    await sessionService.updateServerState({
      state: "SYNCING" as ServerState,
    });

    // Trigger R2 sync on VPS
    try {
      await vpsService.triggerSync(state.vps_ip, c.env.WEBHOOK_SECRET);
    } catch (error) {
      console.error("Sync failed:", error);
      // Continue with shutdown even if sync fails
    }
  }

  // Update state to TERMINATING
  await sessionService.updateServerState({
    state: "TERMINATING" as ServerState,
  });

  // Delete VPS
  if (state.vps_id) {
    try {
      await hetznerService.deleteServer(parseInt(state.vps_id));
    } catch (error) {
      console.error("Failed to delete VPS:", error);
    }
  }

  // Calculate session duration and cost
  const startTime = state.started_at ? new Date(state.started_at).getTime() : Date.now();
  const durationSeconds = Math.floor((Date.now() - startTime) / 1000);
  const hourlyRate = state.region ? getHourlyRate(state.region as Region) : 0.0085;
  const costUsd = (durationSeconds / 3600) * hourlyRate;

  // End session
  if (state.session_id) {
    const tasks = await sessionService.getSessionTasks(state.session_id);
    const completedTasks = tasks.filter((t) => t.status === "completed").length;

    await sessionService.endSession(state.session_id, {
      durationSeconds,
      costUsd,
      shutdownReason: "manual",
      tasksCompleted: completedTasks,
    });
  }

  // Reset server state
  await sessionService.resetServerState();

  return c.json({
    status: "terminated",
    message: "Server has been stopped",
    durationSeconds,
    costUsd: Math.round(costUsd * 100) / 100,
  });
});

/**
 * GET /api/status - Get current session status
 */
app.get("/api/status", async (c) => {
  const sessionService = c.get("sessionService");

  const state = await sessionService.getServerState();

  if (!state || state.state === "OFFLINE") {
    // Get this month's summary
    const month = new Date().toISOString().slice(0, 7);
    const summary = await sessionService.getMonthlySummary(month);

    return c.json({
      state: "OFFLINE",
      costs: {
        thisMonth: summary.totalCost,
      },
    });
  }

  // Calculate uptime and costs
  const startTime = state.started_at ? new Date(state.started_at).getTime() : Date.now();
  const uptime = Math.floor((Date.now() - startTime) / 1000);
  const hourlyRate = state.region ? getHourlyRate(state.region as Region) : 0.0085;
  const currentSessionCost = (uptime / 3600) * hourlyRate;

  // Calculate idle time
  const lastActivity = state.last_activity
    ? new Date(state.last_activity).getTime()
    : startTime;
  const idleTime = Math.floor((Date.now() - lastActivity) / 1000);

  // Get monthly summary
  const month = new Date().toISOString().slice(0, 7);
  const summary = await sessionService.getMonthlySummary(month);

  // Get config for idle timeout
  const idleTimeoutConfig = await sessionService.getConfig("idleTimeout");
  const idleTimeout = idleTimeoutConfig
    ? parseInt(idleTimeoutConfig)
    : parseInt(c.env.DEFAULT_IDLE_TIMEOUT) || 7200;

  return c.json({
    state: state.state,
    sessionId: state.session_id,
    region: state.region,
    serverId: state.vps_id,
    serverIp: state.vps_ip,
    uptime,
    idleTime,
    idleTimeout,
    terminalUrl: state.vps_ip ? `http://${state.vps_ip}:7681` : null,
    lastActivity: state.last_activity,
    lastHeartbeat: state.last_heartbeat,
    currentTask: state.current_task,
    costs: {
      currentSession: Math.round(currentSessionCost * 100) / 100,
      hourlyRate,
      thisMonth: summary.totalCost + currentSessionCost,
    },
  });
});

/**
 * POST /api/task - Send a task to the running agent
 *
 * Protected by:
 * - Threshold: Rate limiting (100 tasks/hour)
 * - Songbird: Prompt injection detection
 */
app.post("/api/task", async (c) => {
  const sessionService = c.get("sessionService");
  const vpsService = c.get("vpsService");
  const songbird = c.get("songbird");
  const threshold = c.get("threshold");

  // Rate limiting (Threshold pattern)
  const identifier = c.req.header("CF-Connecting-IP") ||
                     c.req.header("X-Forwarded-For")?.split(",")[0] ||
                     "anonymous";
  const rateLimit = await threshold.checkRateLimit("api/task", identifier);
  if (!rateLimit.allowed) {
    throw new HTTPException(429, { message: rateLimit.message || "Rate limit exceeded" });
  }
  await threshold.recordRequest("api/task", identifier);

  const state = await sessionService.getServerState();
  if (!state || state.state !== "RUNNING") {
    throw new HTTPException(400, { message: "Server is not running" });
  }

  if (!state.vps_ip) {
    throw new HTTPException(500, { message: "VPS IP not available" });
  }

  const body = await c.req.json<TaskRequest>();

  // Input validation (Songbird pattern)
  const validation = songbird.validateInput(body.task);
  if (!validation.valid) {
    throw new HTTPException(400, {
      message: `Invalid task: ${validation.issues.join(", ")}`,
    });
  }

  // Protect task with canary marker
  const protected_ = songbird.protectTask(body.task);
  const taskId = generateTaskId();

  // Create task record (store sanitized version)
  await sessionService.createTask({
    sessionId: state.session_id!,
    taskId,
    description: protected_.sanitizedTask,
    mode: body.mode,
  });

  // Update current task
  await sessionService.updateServerState({
    current_task: protected_.sanitizedTask,
    last_activity: new Date().toISOString(),
  });

  // Send task to VPS
  try {
    await vpsService.sendTask(
      state.vps_ip,
      c.env.WEBHOOK_SECRET,
      protected_.sanitizedTask,
      body.mode
    );
  } catch (error) {
    // Update task as failed
    await sessionService.updateTask(taskId, {
      status: "failed",
      completedAt: new Date().toISOString(),
    });
    throw new HTTPException(500, {
      message: `Failed to send task: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }

  // Update task as running
  await sessionService.updateTask(taskId, { status: "running" });

  return c.json({
    taskId,
    status: "queued",
    message: "Task sent to agent",
    warnings: protected_.warnings.length > 0 ? protected_.warnings : undefined,
  });
});

/**
 * GET /api/projects - List configured repositories
 */
app.get("/api/projects", async (c) => {
  const sessionService = c.get("sessionService");
  const repositories = await sessionService.getRepositories();

  return c.json({
    projects: repositories.map((repo) => ({
      id: repo.id,
      name: repo.name,
      url: repo.url,
      branch: repo.branch,
      path: repo.path,
      enabled: repo.enabled === 1,
      lastSync: repo.last_sync,
    })),
  });
});

/**
 * POST /api/sync - Trigger manual R2 sync
 */
app.post("/api/sync", async (c) => {
  const sessionService = c.get("sessionService");
  const vpsService = c.get("vpsService");

  const state = await sessionService.getServerState();
  if (!state || state.state !== "RUNNING") {
    throw new HTTPException(400, { message: "Server is not running" });
  }

  if (!state.vps_ip) {
    throw new HTTPException(500, { message: "VPS IP not available" });
  }

  try {
    await vpsService.triggerSync(state.vps_ip, c.env.WEBHOOK_SECRET);
    return c.json({
      status: "syncing",
      message: "Syncing workspace to R2...",
    });
  } catch (error) {
    throw new HTTPException(500, {
      message: `Sync failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }
});

/**
 * GET /api/history - Get session history
 */
app.get("/api/history", async (c) => {
  const sessionService = c.get("sessionService");

  const limit = parseInt(c.req.query("limit") || "10");
  const offset = parseInt(c.req.query("offset") || "0");

  const sessions = await sessionService.getSessions(limit, offset);
  const month = new Date().toISOString().slice(0, 7);
  const summary = await sessionService.getMonthlySummary(month);

  return c.json({
    sessions: sessions.map((s) => ({
      sessionId: s.session_id,
      startedAt: s.started_at,
      endedAt: s.ended_at,
      duration: s.duration_seconds,
      durationFormatted: formatDuration(s.duration_seconds || 0),
      region: s.region,
      costUsd: s.cost_usd,
      tasksCompleted: s.tasks_completed,
      shutdownReason: s.shutdown_reason,
    })),
    thisMonth: {
      totalHours: Math.round(summary.totalHours * 10) / 10,
      totalCost: Math.round(summary.totalCost * 100) / 100,
      sessionCount: summary.sessionCount,
    },
  });
});

/**
 * POST /api/config - Update configuration
 */
app.post("/api/config", async (c) => {
  const sessionService = c.get("sessionService");
  const body = await c.req.json<ConfigUpdateRequest>();

  if (body.idleTimeout !== undefined) {
    await sessionService.setConfig("idleTimeout", body.idleTimeout.toString());
  }

  if (body.defaultRegion !== undefined) {
    await sessionService.setConfig("defaultRegion", body.defaultRegion);
  }

  if (body.autoCommit !== undefined) {
    await sessionService.setConfig("autoCommit", body.autoCommit.toString());
  }

  if (body.models?.reasoning) {
    await sessionService.setConfig("model.reasoning", body.models.reasoning);
  }

  if (body.models?.vision) {
    await sessionService.setConfig("model.vision", body.models.vision);
  }

  const config = await sessionService.getAllConfig();
  return c.json({ status: "updated", config });
});

// ============================================================================
// Webhook Routes (VPS → Worker communication)
// ============================================================================

/**
 * POST /webhook/ready - VPS signals boot complete
 */
app.post("/webhook/ready", async (c) => {
  if (!verifyWebhookSecret(c)) {
    throw new HTTPException(401, { message: "Unauthorized" });
  }

  const sessionService = c.get("sessionService");
  const dnsService = c.get("dnsService");

  const body = await c.req.json<{ serverId: string; ip: string }>();

  // Update DNS
  try {
    await dnsService.updateBloomRecord(body.ip);
  } catch (error) {
    console.error("Failed to update DNS:", error);
  }

  // Update server state
  await sessionService.updateServerState({
    state: "RUNNING" as ServerState,
    vps_id: body.serverId,
    vps_ip: body.ip,
    last_heartbeat: new Date().toISOString(),
    last_activity: new Date().toISOString(),
    dns_updated_at: new Date().toISOString(),
  });

  return c.json({ status: "ok" });
});

/**
 * POST /webhook/heartbeat - Daemon reports status
 */
app.post("/webhook/heartbeat", async (c) => {
  if (!verifyWebhookSecret(c)) {
    throw new HTTPException(401, { message: "Unauthorized" });
  }

  const sessionService = c.get("sessionService");
  const body = await c.req.json<{
    state: string;
    idleSeconds: number;
    timestamp: string;
  }>();

  const now = new Date().toISOString();
  const updates: Record<string, unknown> = {
    last_heartbeat: now,
  };

  // Update idle state if needed
  const state = await sessionService.getServerState();
  if (state) {
    const idleThreshold = 300; // 5 minutes
    if (body.idleSeconds > idleThreshold && state.state === "RUNNING") {
      updates.state = "IDLE" as ServerState;
      if (!state.idle_since) {
        updates.idle_since = now;
      }
    } else if (body.idleSeconds < idleThreshold && state.state === "IDLE") {
      updates.state = "RUNNING" as ServerState;
      updates.idle_since = null;
      updates.last_activity = now;
    }
  }

  await sessionService.updateServerState(updates);

  return c.json({ status: "ok" });
});

/**
 * POST /webhook/task-complete - Agent signals task done
 */
app.post("/webhook/task-complete", async (c) => {
  if (!verifyWebhookSecret(c)) {
    throw new HTTPException(401, { message: "Unauthorized" });
  }

  const sessionService = c.get("sessionService");
  const hetznerService = c.get("hetznerService");

  const body = await c.req.json<{
    status: string;
    exitCode?: number;
    taskId?: string;
    triggerShutdown?: boolean;
    timestamp: string;
  }>();

  const state = await sessionService.getServerState();

  // Update task if taskId provided
  if (body.taskId) {
    await sessionService.updateTask(body.taskId, {
      status: body.status === "completed" ? "completed" : "failed",
      completedAt: body.timestamp,
    });
  }

  // Clear current task
  await sessionService.updateServerState({
    current_task: null,
    last_activity: new Date().toISOString(),
  });

  // Trigger shutdown if requested and auto-shutdown is enabled
  if (body.triggerShutdown) {
    const autoShutdown = await sessionService.getConfig("autoShutdownOnComplete");
    if (autoShutdown !== "false" && state?.vps_id) {
      // Initiate shutdown sequence
      await sessionService.updateServerState({
        state: "TERMINATING" as ServerState,
      });

      try {
        await hetznerService.deleteServer(parseInt(state.vps_id));
      } catch (error) {
        console.error("Failed to delete VPS:", error);
      }

      // End session
      if (state.session_id && state.started_at) {
        const durationSeconds = Math.floor(
          (Date.now() - new Date(state.started_at).getTime()) / 1000
        );
        const hourlyRate = state.region
          ? getHourlyRate(state.region as Region)
          : 0.0085;
        const costUsd = (durationSeconds / 3600) * hourlyRate;

        const tasks = await sessionService.getSessionTasks(state.session_id);
        const completedTasks = tasks.filter((t) => t.status === "completed").length;

        await sessionService.endSession(state.session_id, {
          durationSeconds,
          costUsd,
          shutdownReason: "task_complete",
          tasksCompleted: completedTasks,
        });
      }

      await sessionService.resetServerState();
    }
  }

  return c.json({ status: "ok" });
});

/**
 * POST /webhook/idle-timeout - Daemon triggers shutdown
 */
app.post("/webhook/idle-timeout", async (c) => {
  if (!verifyWebhookSecret(c)) {
    throw new HTTPException(401, { message: "Unauthorized" });
  }

  const sessionService = c.get("sessionService");
  const hetznerService = c.get("hetznerService");

  const state = await sessionService.getServerState();
  if (!state || !state.vps_id) {
    return c.json({ status: "ok", message: "No active session" });
  }

  // Update state to SYNCING
  await sessionService.updateServerState({
    state: "SYNCING" as ServerState,
  });

  // Wait a moment for sync to complete (VPS will sync before calling this)
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Update state to TERMINATING
  await sessionService.updateServerState({
    state: "TERMINATING" as ServerState,
  });

  // Delete VPS
  try {
    await hetznerService.deleteServer(parseInt(state.vps_id));
  } catch (error) {
    console.error("Failed to delete VPS:", error);
  }

  // End session
  if (state.session_id && state.started_at) {
    const durationSeconds = Math.floor(
      (Date.now() - new Date(state.started_at).getTime()) / 1000
    );
    const hourlyRate = state.region ? getHourlyRate(state.region as Region) : 0.0085;
    const costUsd = (durationSeconds / 3600) * hourlyRate;

    const tasks = await sessionService.getSessionTasks(state.session_id);
    const completedTasks = tasks.filter((t) => t.status === "completed").length;

    await sessionService.endSession(state.session_id, {
      durationSeconds,
      costUsd,
      shutdownReason: "idle_timeout",
      tasksCompleted: completedTasks,
    });
  }

  await sessionService.resetServerState();

  return c.json({ status: "ok", message: "Shutdown initiated" });
});

// ============================================================================
// Helpers
// ============================================================================

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

export default app;
