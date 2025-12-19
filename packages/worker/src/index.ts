/**
 * Grove Bloom Control Worker
 *
 * Orchestrates Hetzner VPS provisioning, R2 sync, D1 state tracking,
 * and WebSocket proxy for ttyd terminal.
 */

import { Hono } from "hono";
import { cors } from "hono/cors";

type Bindings = {
  BLOOM_REPOS: R2Bucket;
  BLOOM_STATE: R2Bucket;
  DB: D1Database;
  HETZNER_API_TOKEN: string;
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

const app = new Hono<{ Bindings: Bindings }>();

// CORS for dashboard
app.use(
  "/*",
  cors({
    origin: ["https://bloom.grove.place", "http://localhost:5173"],
    credentials: true,
  }),
);

// Health check
app.get("/", (c) => {
  return c.json({
    service: "bloom-control",
    version: "0.1.0",
    status: "online",
  });
});

// API Routes (scaffolding only)
app.post("/api/start", async (c) => {
  // TODO: Provision Hetzner VPS
  return c.json({ status: "not_implemented" }, 501);
});

app.post("/api/stop", async (c) => {
  // TODO: Graceful shutdown + R2 sync
  return c.json({ status: "not_implemented" }, 501);
});

app.get("/api/status", async (c) => {
  // TODO: Get current session status from D1
  return c.json({ status: "not_implemented" }, 501);
});

app.post("/api/task", async (c) => {
  // TODO: Send task to running agent
  return c.json({ status: "not_implemented" }, 501);
});

app.get("/api/projects", async (c) => {
  // TODO: List projects from D1 repositories table
  return c.json({ status: "not_implemented" }, 501);
});

app.post("/api/sync", async (c) => {
  // TODO: Manual R2 sync trigger
  return c.json({ status: "not_implemented" }, 501);
});

app.get("/api/history", async (c) => {
  // TODO: Get session history from D1
  return c.json({ status: "not_implemented" }, 501);
});

app.post("/api/config", async (c) => {
  // TODO: Update config in D1
  return c.json({ status: "not_implemented" }, 501);
});

// Webhook Routes (VPS → Worker communication)
app.post("/webhook/ready", async (c) => {
  // TODO: VPS boot complete, update DNS
  return c.json({ status: "not_implemented" }, 501);
});

app.post("/webhook/heartbeat", async (c) => {
  // TODO: Update last_heartbeat in D1
  return c.json({ status: "not_implemented" }, 501);
});

app.post("/webhook/task-complete", async (c) => {
  // TODO: Handle task completion, trigger shutdown if enabled
  return c.json({ status: "not_implemented" }, 501);
});

app.post("/webhook/idle-timeout", async (c) => {
  // TODO: Trigger graceful shutdown
  return c.json({ status: "not_implemented" }, 501);
});

// WebSocket proxy for terminal (future)
// app.get('/terminal', async (c) => {
//   // TODO: Proxy WebSocket to VPS ttyd
// });

export default app;
