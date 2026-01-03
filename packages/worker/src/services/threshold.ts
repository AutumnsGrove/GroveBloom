/**
 * Threshold - Rate Limiting & Abuse Prevention Service
 *
 * Four-layer protection:
 * 1. Edge protection - Cloudflare Workers KV rate limiting
 * 2. Endpoint-specific limits - Different rates for different operations
 * 3. Cost protection - Track and limit spending
 * 4. Abuse detection - Pattern detection for suspicious behavior
 *
 * @example
 * const threshold = createThresholdService(kv);
 * const result = await threshold.checkRateLimit('api/start', userId);
 * if (!result.allowed) {
 *   return c.json({ error: result.message }, 429);
 * }
 */

export interface RateLimitConfig {
  windowSeconds: number;
  maxRequests: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  message?: string;
}

export interface CostProtectionResult {
  allowed: boolean;
  currentSpend: number;
  limit: number;
  message?: string;
}

export interface AbuseCheckResult {
  suspicious: boolean;
  reasons: string[];
  riskScore: number;
}

export interface ThresholdService {
  checkRateLimit(endpoint: string, identifier: string): Promise<RateLimitResult>;
  checkCostLimit(userId: string, additionalCost: number): Promise<CostProtectionResult>;
  checkForAbuse(identifier: string, context: AbuseContext): Promise<AbuseCheckResult>;
  recordRequest(endpoint: string, identifier: string): Promise<void>;
  recordCost(userId: string, cost: number): Promise<void>;
}

export interface AbuseContext {
  endpoint: string;
  payloadSize?: number;
  timestamp: number;
  userAgent?: string;
  ip?: string;
}

// Endpoint-specific rate limits
const RATE_LIMITS: Record<string, RateLimitConfig> = {
  // VPS operations - expensive, rate limit heavily
  "api/start": { windowSeconds: 3600, maxRequests: 2 }, // 2 per hour
  "api/stop": { windowSeconds: 300, maxRequests: 10 }, // 10 per 5 min

  // Task operations - moderate limits
  "api/task": { windowSeconds: 3600, maxRequests: 100 }, // 100 per hour
  "api/sync": { windowSeconds: 3600, maxRequests: 10 }, // 10 per hour

  // Read operations - higher limits
  "api/status": { windowSeconds: 60, maxRequests: 60 }, // 60 per minute (polling)
  "api/history": { windowSeconds: 60, maxRequests: 30 }, // 30 per minute
  "api/projects": { windowSeconds: 60, maxRequests: 30 }, // 30 per minute
  "api/config": { windowSeconds: 60, maxRequests: 20 }, // 20 per minute

  // Webhook endpoints - internal, high limits
  "webhook/ready": { windowSeconds: 60, maxRequests: 10 },
  "webhook/heartbeat": { windowSeconds: 60, maxRequests: 120 }, // 2 per second
  "webhook/task-complete": { windowSeconds: 60, maxRequests: 60 },
  "webhook/idle-timeout": { windowSeconds: 60, maxRequests: 10 },

  // Default fallback
  default: { windowSeconds: 60, maxRequests: 100 },
};

// Daily cost limit in USD
const DEFAULT_DAILY_COST_LIMIT = 5.0;

// Abuse detection thresholds
const ABUSE_THRESHOLDS = {
  rapidFireRequestsPerSecond: 10,
  maxPayloadSizeBytes: 10240, // 10KB
  suspiciousUserAgentPatterns: [
    /^curl/i,
    /^wget/i,
    /^python-requests/i,
    /^Go-http-client/i,
  ],
};

/**
 * Get the rate limit key for KV storage
 */
function getRateLimitKey(endpoint: string, identifier: string, windowStart: number): string {
  return `ratelimit:${endpoint}:${identifier}:${windowStart}`;
}

/**
 * Get current window start timestamp
 */
function getWindowStart(windowSeconds: number): number {
  return Math.floor(Date.now() / 1000 / windowSeconds) * windowSeconds;
}

/**
 * Get the cost tracking key for today
 */
function getCostKey(userId: string): string {
  const today = new Date().toISOString().slice(0, 10);
  return `cost:${userId}:${today}`;
}

/**
 * Get the abuse tracking key
 */
function getAbuseKey(identifier: string): string {
  return `abuse:${identifier}:${Math.floor(Date.now() / 1000)}`;
}

export function createThresholdService(kv: KVNamespace | null): ThresholdService {
  return {
    /**
     * Check if a request is within rate limits
     */
    async checkRateLimit(endpoint: string, identifier: string): Promise<RateLimitResult> {
      // If KV is not available, allow all requests (development mode)
      if (!kv) {
        return { allowed: true, remaining: 999, resetAt: 0 };
      }

      const config = RATE_LIMITS[endpoint] || RATE_LIMITS.default;
      const windowStart = getWindowStart(config.windowSeconds);
      const key = getRateLimitKey(endpoint, identifier, windowStart);

      // Get current count
      const currentCount = parseInt((await kv.get(key)) || "0", 10);
      const remaining = Math.max(0, config.maxRequests - currentCount);
      const resetAt = windowStart + config.windowSeconds;

      if (currentCount >= config.maxRequests) {
        return {
          allowed: false,
          remaining: 0,
          resetAt,
          message: `Rate limit exceeded. Try again in ${resetAt - Math.floor(Date.now() / 1000)} seconds.`,
        };
      }

      return { allowed: true, remaining: remaining - 1, resetAt };
    },

    /**
     * Record a request for rate limiting
     */
    async recordRequest(endpoint: string, identifier: string): Promise<void> {
      if (!kv) return;

      const config = RATE_LIMITS[endpoint] || RATE_LIMITS.default;
      const windowStart = getWindowStart(config.windowSeconds);
      const key = getRateLimitKey(endpoint, identifier, windowStart);

      // Get current count and increment
      const currentCount = parseInt((await kv.get(key)) || "0", 10);
      await kv.put(key, (currentCount + 1).toString(), {
        expirationTtl: config.windowSeconds + 60, // Add buffer
      });
    },

    /**
     * Check if a user is within their daily cost limit
     */
    async checkCostLimit(userId: string, additionalCost: number): Promise<CostProtectionResult> {
      if (!kv) {
        return { allowed: true, currentSpend: 0, limit: DEFAULT_DAILY_COST_LIMIT };
      }

      const key = getCostKey(userId);
      const currentSpend = parseFloat((await kv.get(key)) || "0");
      const projectedSpend = currentSpend + additionalCost;

      if (projectedSpend > DEFAULT_DAILY_COST_LIMIT) {
        return {
          allowed: false,
          currentSpend,
          limit: DEFAULT_DAILY_COST_LIMIT,
          message: `Daily cost limit of $${DEFAULT_DAILY_COST_LIMIT} exceeded. Current: $${currentSpend.toFixed(2)}`,
        };
      }

      return { allowed: true, currentSpend, limit: DEFAULT_DAILY_COST_LIMIT };
    },

    /**
     * Record a cost for tracking
     */
    async recordCost(userId: string, cost: number): Promise<void> {
      if (!kv) return;

      const key = getCostKey(userId);
      const currentSpend = parseFloat((await kv.get(key)) || "0");
      await kv.put(key, (currentSpend + cost).toString(), {
        expirationTtl: 86400 + 3600, // 25 hours (to cover timezone edge cases)
      });
    },

    /**
     * Check for abuse patterns
     */
    async checkForAbuse(identifier: string, context: AbuseContext): Promise<AbuseCheckResult> {
      const reasons: string[] = [];
      let riskScore = 0;

      // Check payload size
      if (context.payloadSize && context.payloadSize > ABUSE_THRESHOLDS.maxPayloadSizeBytes) {
        reasons.push(`Payload too large: ${context.payloadSize} bytes`);
        riskScore += 30;
      }

      // Check suspicious user agents
      if (context.userAgent) {
        for (const pattern of ABUSE_THRESHOLDS.suspiciousUserAgentPatterns) {
          if (pattern.test(context.userAgent)) {
            reasons.push(`Suspicious user agent: ${context.userAgent}`);
            riskScore += 10;
            break;
          }
        }
      }

      // Check for rapid-fire requests (requires KV)
      if (kv) {
        const key = getAbuseKey(identifier);
        const recentRequests = parseInt((await kv.get(key)) || "0", 10);

        if (recentRequests > ABUSE_THRESHOLDS.rapidFireRequestsPerSecond) {
          reasons.push(`Rapid-fire requests detected: ${recentRequests}/sec`);
          riskScore += 50;
        }

        // Increment counter
        await kv.put(key, (recentRequests + 1).toString(), {
          expirationTtl: 2, // 2 second window
        });
      }

      return {
        suspicious: riskScore >= 50,
        reasons,
        riskScore,
      };
    },
  };
}

/**
 * Helper to create rate limit middleware for Hono
 */
export function createRateLimitMiddleware(threshold: ThresholdService) {
  return async (c: {
    req: { path: string; header: (name: string) => string | undefined };
    json: (body: unknown, status?: number) => Response;
  }, next: () => Promise<void>) => {
    // Extract endpoint from path
    const endpoint = c.req.path.replace(/^\//, "");

    // Get identifier (IP or user ID)
    const identifier = c.req.header("CF-Connecting-IP") ||
                       c.req.header("X-Forwarded-For")?.split(",")[0] ||
                       "anonymous";

    // Check rate limit
    const result = await threshold.checkRateLimit(endpoint, identifier);

    if (!result.allowed) {
      return c.json(
        {
          error: "Rate limit exceeded",
          message: result.message,
          retryAfter: result.resetAt - Math.floor(Date.now() / 1000),
        },
        429
      );
    }

    // Record the request
    await threshold.recordRequest(endpoint, identifier);

    // Continue to next handler
    await next();
  };
}
