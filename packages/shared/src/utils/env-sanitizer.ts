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
 * Short sensitive words matched as whole tokens (after splitting keys on
 * non-alphanumerics and camelCase boundaries). Token matching catches
 * GITHUB_PAT, SSH_KEY, MY_PWD, githubPat without the substring false
 * positives a plain pattern would hit (PATH, PATTERN, MONKEY).
 */
const SENSITIVE_TOKENS = new Set([
  'pat', 'key', 'keys', 'pwd', 'passwd', 'cred', 'creds', 'bearer', 'oauth', 'jwt'
]);

function hasSensitiveToken(key: string): boolean {
  return key
    .split(/[^a-zA-Z0-9]+/)
    .flatMap(part => part.split(/(?<=[a-z0-9])(?=[A-Z])/))
    .some(token => SENSITIVE_TOKENS.has(token.toLowerCase()));
}

/**
 * Redact sensitive environment variable values for safe logging.
 */
export function sanitizeEnvForLogging(env: Record<string, string>): Record<string, string> {
  const sanitized: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    if (SENSITIVE_PATTERNS.some(p => p.test(key)) || hasSensitiveToken(key)) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

/**
 * Shallow-sanitize a proxy init payload or command object before logging.
 * Specifically targets the `adapterCommand.env` field which contains process.env.
 *
 * The env body is replaced with a count summary rather than a per-key
 * redacted copy: logs never need the values, and keyword redaction cannot
 * anticipate every secret-bearing key name (issue #146).
 */
export function sanitizePayloadForLogging(payload: unknown): unknown {
  if (!payload || typeof payload !== 'object') return payload;

  const obj = { ...(payload as Record<string, unknown>) };

  if (obj.adapterCommand && typeof obj.adapterCommand === 'object') {
    const cmd = { ...(obj.adapterCommand as Record<string, unknown>) };
    if (cmd.env && typeof cmd.env === 'object') {
      cmd.env = `<${Object.keys(cmd.env as Record<string, string>).length} env vars redacted>`;
    }
    obj.adapterCommand = cmd;
  }

  return obj;
}

/**
 * Pattern matching sensitive key names that may appear in stderr output.
 * Matches lines like `ANTHROPIC_API_KEY=sk-ant-...`, `GITHUB_PAT=...`,
 * or JSON `"OPENAI_API_KEY": "sk-..."`. The short words (pat, key, pwd, ...)
 * require an immediately following `=`, `:` or `"`, so PATH=/usr/bin stays.
 */
const STDERR_SENSITIVE_LINE = /(?:api[_-]?key|secret|token|password|passwd|pwd|credential|private[_-]?key|auth|pat|key|bearer|jwt|oauth)[=:"]\s*/i;

/**
 * Well-known secret value shapes, for secrets whose key name never appears
 * on the line: GitHub tokens (ghp_/gho_/... and github_pat_), sk- API keys,
 * Slack xox tokens, AWS access key ids, JWTs, PEM private key headers.
 */
const STDERR_SENSITIVE_VALUE = /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_-]{20,}|xox[baprs]-[A-Za-z0-9-]{10,}|AKIA[0-9A-Z]{16}|eyJ[A-Za-z0-9_-]{10,}\.eyJ)|-----BEGIN[A-Z ]*PRIVATE KEY-----/;

/**
 * Sanitize stderr lines to redact any that appear to contain sensitive env var assignments.
 */
export function sanitizeStderr(lines: string[]): string[] {
  return lines.map(line => {
    if (STDERR_SENSITIVE_LINE.test(line) || STDERR_SENSITIVE_VALUE.test(line)) {
      return '[REDACTED — line contained sensitive data]';
    }
    return line;
  });
}

/**
 * Sanitize accumulated child-process output and cap it for embedding in an
 * error message or log entry. Splits on CRLF/LF, drops blank lines, redacts
 * secret-looking lines, then keeps only the last `maxLines` lines and at most
 * `maxChars` characters (ellipsis-prefixed), labelled "(last N of M lines)"
 * when lines were dropped — the same bounds ProxyManager applies to stderr
 * embedded in init-failure errors (issue #146).
 */
export function sanitizeStderrTail(
  text: string,
  opts: { maxLines?: number; maxChars?: number } = {}
): string {
  const { maxLines = 10, maxChars = 2000 } = opts;
  const all = sanitizeStderr(text.split(/\r?\n/).filter(line => line.trim().length > 0));
  const tail = all.slice(-maxLines);
  let out = tail.join('\n');
  if (out.length > maxChars) {
    out = '…' + out.slice(-maxChars);
  }
  return all.length > tail.length
    ? `${out} (last ${tail.length} of ${all.length} lines)`
    : out;
}
