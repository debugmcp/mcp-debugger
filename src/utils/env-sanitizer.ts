/**
 * Environment variable sanitization for logging and error messages.
 *
 * Prevents sensitive values (API keys, tokens, passwords) from leaking
 * into log files, stderr captures, or MCP tool responses.
 */

const SENSITIVE_PATTERNS = [
  /api[_-]?key/i,
  /secret/i,
  /token/i,
  /password/i,
  /credential/i,
  /private[_-]?key/i,
  /auth/i,
  /session[_-]?id/i,
  /access[_-]?key/i,
  /signing/i,
];

/**
 * Redact sensitive environment variable values for safe logging.
 */
export function sanitizeEnvForLogging(env: Record<string, string>): Record<string, string> {
  const sanitized: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    if (SENSITIVE_PATTERNS.some(p => p.test(key))) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

/**
 * Deep-sanitize a proxy init payload or command object before logging.
 * Specifically targets the `adapterCommand.env` field which contains process.env.
 */
export function sanitizePayloadForLogging(payload: unknown): unknown {
  if (!payload || typeof payload !== 'object') return payload;

  const obj = { ...(payload as Record<string, unknown>) };

  // Sanitize adapterCommand.env
  if (obj.adapterCommand && typeof obj.adapterCommand === 'object') {
    const cmd = { ...(obj.adapterCommand as Record<string, unknown>) };
    if (cmd.env && typeof cmd.env === 'object') {
      cmd.env = sanitizeEnvForLogging(cmd.env as Record<string, string>);
    }
    obj.adapterCommand = cmd;
  }

  return obj;
}

/**
 * Pattern matching sensitive values that may appear in stderr output.
 * Matches lines like `ANTHROPIC_API_KEY=sk-ant-...` or JSON `"OPENAI_API_KEY": "sk-..."`.
 */
const STDERR_SENSITIVE_LINE = /(?:api[_-]?key|secret|token|password|credential|private[_-]?key|auth)[=:"]\s*/i;

/**
 * Sanitize stderr lines to redact any that appear to contain sensitive env var assignments.
 */
export function sanitizeStderr(lines: string[]): string[] {
  return lines.map(line => {
    if (STDERR_SENSITIVE_LINE.test(line)) {
      return '[REDACTED — line contained sensitive data]';
    }
    return line;
  });
}
