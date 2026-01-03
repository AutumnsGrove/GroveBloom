/**
 * Songbird - Prompt Injection Protection Service
 *
 * Multi-layer defense against users trying to manipulate the AI agent
 * through malicious task input.
 *
 * Techniques:
 * 1. Canary markers - Unique tokens injected that shouldn't appear in output
 * 2. Input validation - Block suspicious keywords and patterns
 * 3. Length limits - Prevent prompt padding attacks
 * 4. Output validation - Detect if canary was reproduced
 *
 * @example
 * const songbird = createSongbirdService();
 * const { sanitizedTask, canary } = songbird.protectTask(userInput);
 * // Later...
 * const isValid = songbird.validateOutput(output, canary);
 */

// Using Web Crypto API (available in Cloudflare Workers)

export interface SongbirdConfig {
  maxTaskLength: number;
  blockedKeywords: string[];
  blockedPatterns: RegExp[];
}

export interface ProtectedTask {
  sanitizedTask: string;
  canary: string;
  taskWithCanary: string;
  warnings: string[];
}

export interface ValidationResult {
  valid: boolean;
  issues: string[];
}

export interface SongbirdService {
  protectTask(task: string): ProtectedTask;
  validateOutput(output: string, canary: string): ValidationResult;
  validateInput(task: string): ValidationResult;
}

const DEFAULT_CONFIG: SongbirdConfig = {
  maxTaskLength: 5000,
  blockedKeywords: [
    // Dangerous shell commands
    "rm -rf /",
    "sudo rm",
    "mkfs",
    "dd if=",
    ":(){:|:&};:",
    // SQL injection patterns
    "DROP TABLE",
    "DROP DATABASE",
    "DELETE FROM",
    "TRUNCATE TABLE",
    // Exfiltration patterns
    "curl.*|.*base64",
    "wget.*&&.*sh",
    "nc -e",
    "bash -i",
    "/dev/tcp/",
    // Prompt manipulation
    "ignore previous instructions",
    "ignore all instructions",
    "disregard your instructions",
    "forget your instructions",
    "new system prompt",
    "override system",
    "you are now",
    "pretend you are",
    "act as if",
    "jailbreak",
    "DAN mode",
  ],
  blockedPatterns: [
    // Base64 encoded commands
    /echo\s+[A-Za-z0-9+/=]{20,}\s*\|\s*base64\s+-d/i,
    // Reverse shell patterns
    /\b(nc|netcat|ncat)\s+.*\s+-[elp]/i,
    // Environment variable exfiltration
    /\$\{?\w*PASSWORD\w*\}?|\$\{?\w*SECRET\w*\}?|\$\{?\w*TOKEN\w*\}?/i,
    // Excessive unicode/special chars (prompt padding)
    /[\u200B-\u200D\uFEFF]{10,}/,
    // Hidden text patterns
    /\[INST\]|\[\/INST\]|<\|im_start\|>|<\|im_end\|>/i,
    // Attempting to access system files
    /\/etc\/(passwd|shadow|sudoers)/i,
    // SSH key theft
    /\.ssh\/(id_rsa|authorized_keys)/i,
  ],
};

/**
 * Generate a unique canary marker that should never appear in legitimate output
 */
function generateCanary(): string {
  const uuid = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  return `🌿BLOOM_CANARY_${uuid}_END🌿`;
}

/**
 * Sanitize task input by removing potentially dangerous content
 */
function sanitizeTask(task: string, config: SongbirdConfig): { sanitized: string; warnings: string[] } {
  const warnings: string[] = [];
  let sanitized = task;

  // Trim and normalize whitespace
  sanitized = sanitized.trim().replace(/\s+/g, " ");

  // Remove null bytes and other control characters (except newlines)
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

  // Check length
  if (sanitized.length > config.maxTaskLength) {
    warnings.push(`Task truncated from ${sanitized.length} to ${config.maxTaskLength} characters`);
    sanitized = sanitized.slice(0, config.maxTaskLength);
  }

  return { sanitized, warnings };
}

/**
 * Check input for blocked keywords and patterns
 */
function checkForBlockedContent(
  task: string,
  config: SongbirdConfig
): { blocked: boolean; issues: string[] } {
  const issues: string[] = [];
  const taskLower = task.toLowerCase();

  // Check blocked keywords
  for (const keyword of config.blockedKeywords) {
    if (taskLower.includes(keyword.toLowerCase())) {
      issues.push(`Blocked keyword detected: "${keyword}"`);
    }
  }

  // Check blocked patterns
  for (const pattern of config.blockedPatterns) {
    if (pattern.test(task)) {
      issues.push(`Blocked pattern detected: ${pattern.source.slice(0, 30)}...`);
    }
  }

  return { blocked: issues.length > 0, issues };
}

export function createSongbirdService(customConfig?: Partial<SongbirdConfig>): SongbirdService {
  const config: SongbirdConfig = { ...DEFAULT_CONFIG, ...customConfig };

  return {
    /**
     * Protect a task by sanitizing input and adding canary marker
     */
    protectTask(task: string): ProtectedTask {
      // Sanitize the input
      const { sanitized, warnings } = sanitizeTask(task, config);

      // Generate canary
      const canary = generateCanary();

      // Create task with canary (appended as system marker)
      const taskWithCanary = `${sanitized}\n\n[INTERNAL_VERIFICATION: ${canary}]`;

      return {
        sanitizedTask: sanitized,
        canary,
        taskWithCanary,
        warnings,
      };
    },

    /**
     * Validate task input for blocked content
     */
    validateInput(task: string): ValidationResult {
      // Check length first
      if (task.length > config.maxTaskLength) {
        return {
          valid: false,
          issues: [`Task exceeds maximum length of ${config.maxTaskLength} characters`],
        };
      }

      // Check for empty task
      if (!task.trim()) {
        return {
          valid: false,
          issues: ["Task cannot be empty"],
        };
      }

      // Check for blocked content
      const { blocked, issues } = checkForBlockedContent(task, config);
      if (blocked) {
        return { valid: false, issues };
      }

      return { valid: true, issues: [] };
    },

    /**
     * Validate output to detect if canary was reproduced (potential injection)
     */
    validateOutput(output: string, canary: string): ValidationResult {
      const issues: string[] = [];

      // Check if canary appears in output (injection detected)
      if (output.includes(canary)) {
        issues.push("Canary marker detected in output - potential prompt injection");
      }

      // Check for partial canary patterns
      if (output.includes("BLOOM_CANARY_") || output.includes("_END🌿")) {
        issues.push("Partial canary pattern detected in output");
      }

      // Check for attempts to reproduce internal markers
      if (output.includes("INTERNAL_VERIFICATION")) {
        issues.push("Internal verification marker detected in output");
      }

      return {
        valid: issues.length === 0,
        issues,
      };
    },
  };
}
