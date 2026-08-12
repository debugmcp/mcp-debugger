/**
 * Secret redaction for debugger tool results (issue #237).
 *
 * Debuggers see everything in scope — including credentials. When the
 * debugging driver is an AI agent, variable values flow into model context
 * and transcripts, so credential-shaped values are masked before they leave
 * the server. Unlike the whole-line stderr sanitizer (env-sanitizer.ts),
 * replacement here is per-token and labeled (`<redacted:github-pat>`), so
 * the surrounding value stays legible and the agent can tell what was
 * withheld and why.
 *
 * Pattern provenance: value shapes adapted from the gitleaks default config
 * (https://github.com/gitleaks/gitleaks, MIT license) and this project's
 * pre-existing stderr corpus (issues #146/#153). The name-set + trivial-value
 * design is adapted from microsoft/DebugMCP's secretRedaction module (MIT).
 *
 * Engine rules:
 * - Every rule carries lowercase literal keyword anchors; its regex only runs
 *   when an anchor is present in the text (gitleaks' pre-filter technique).
 * - Patterns use literal prefixes and bounded character-class tails — no
 *   unbounded wildcards, no backtracking hazards on untrusted input.
 * - No trailing word boundaries: tails may butt up against arbitrary text and
 *   a prefix over-match is safer than a miss (matches the stderr corpus
 *   behavior the property tests pin).
 * - Known limitation: values split across chunks (e.g. a secret straddling
 *   two DAP output events) cannot be matched — same class of limitation as
 *   the line-scoped stderr sanitizer.
 */

export interface SecretRule {
  /** Stable rule id; becomes the placeholder label (`<redacted:${id}>`). */
  id: string;
  /** Lowercase literal anchors; the regex only runs if one is present. */
  keywords: string[];
  /** Bounded, non-backtracking pattern with the 'g' flag. */
  pattern: RegExp;
  /**
   * When set, only this capture group is replaced; groups 1..maskGroup-1 are
   * kept verbatim as the prefix (rules must shape their groups accordingly).
   */
  maskGroup?: number;
  /** Provenance note (e.g. the gitleaks rule this was adapted from). */
  note?: string;
}

export interface RedactionHit {
  ruleId: string;
  count: number;
}

export interface RedactionResult {
  value: string;
  hits: RedactionHit[];
  redacted: boolean;
}

/**
 * v1 value-shape corpus. Deliberately excluded: AWS secret access keys by
 * shape (40 base64 chars — pure false-positive machine; the sensitive-name
 * set covers them), standalone entropy detection (industry practice is
 * entropy as per-rule confirmation only), and long-tail providers
 * (Twilio/Heroku/Databricks/… — add on demand).
 */
export const SECRET_VALUE_RULES: readonly SecretRule[] = [
  {
    id: 'pem-private-key',
    keywords: ['-----begin'],
    // Body class excludes '-' so a greedy body always stops at the END
    // delimiter; '\\' catches JSON-escaped newlines (GCP service accounts).
    // Header alone still matches (stderr corpus compatibility).
    pattern: /-----BEGIN[A-Z ]{0,32}PRIVATE KEY(?: BLOCK)?-----[A-Za-z0-9+/=\\\s]{0,8192}(?:-----END[A-Z ]{0,32}PRIVATE KEY(?: BLOCK)?-----)?/g,
    note: 'gitleaks: private-key'
  },
  {
    id: 'github-pat',
    keywords: ['ghp_', 'gho_', 'ghu_', 'ghs_', 'ghr_'],
    pattern: /\bgh[pousr]_[A-Za-z0-9]{20,255}/g,
    note: 'gitleaks: github-pat/github-oauth/github-app-token/github-refresh-token'
  },
  {
    id: 'github-fine-grained-pat',
    keywords: ['github_pat_'],
    pattern: /\bgithub_pat_[A-Za-z0-9_]{20,255}/g,
    note: 'gitleaks: github-fine-grained-pat'
  },
  {
    id: 'gitlab-pat',
    keywords: ['glpat-'],
    pattern: /\bglpat-[A-Za-z0-9_-]{20,50}/g,
    note: 'gitleaks: gitlab-pat'
  },
  {
    id: 'npm-token',
    keywords: ['npm_'],
    pattern: /\bnpm_[A-Za-z0-9]{36}/g,
    note: 'gitleaks: npm-access-token'
  },
  {
    id: 'pypi-token',
    keywords: ['pypi-'],
    pattern: /\bpypi-AgEIcHlwaS5vcmc[A-Za-z0-9_-]{20,1000}/g,
    note: 'gitleaks: pypi-upload-token'
  },
  {
    id: 'huggingface-token',
    keywords: ['hf_'],
    pattern: /\bhf_[A-Za-z0-9]{30,40}/g,
    note: 'gitleaks: huggingface-access-token'
  },
  {
    id: 'openai-style-key',
    keywords: ['sk-'],
    pattern: /\bsk-[A-Za-z0-9_-]{20,255}/g,
    note: 'covers OpenAI (sk-, sk-proj-) and Anthropic (sk-ant-) key shapes'
  },
  {
    id: 'stripe-key',
    keywords: ['sk_live_', 'sk_test_', 'rk_live_', 'rk_test_', 'pk_live_', 'pk_test_'],
    pattern: /\b[srp]k_(?:live|test)_[A-Za-z0-9]{10,99}/g,
    note: 'gitleaks: stripe-access-token'
  },
  {
    id: 'slack-token',
    keywords: ['xox'],
    pattern: /\bxox[baprs]-[A-Za-z0-9-]{10,250}/g,
    note: 'gitleaks: slack-*-token'
  },
  {
    id: 'sendgrid-key',
    keywords: ['sg.'],
    pattern: /\bSG\.[A-Za-z0-9_-]{16,64}\.[A-Za-z0-9_-]{16,64}/g,
    note: 'gitleaks: sendgrid-api-token'
  },
  {
    id: 'google-api-key',
    keywords: ['aiza'],
    pattern: /\bAIza[0-9A-Za-z_-]{35}/g,
    note: 'gitleaks: gcp-api-key'
  },
  {
    id: 'aws-access-key-id',
    keywords: ['akia', 'asia', 'abia', 'acca'],
    pattern: /\b(?:AKIA|ASIA|ABIA|ACCA)[0-9A-Z]{16}/g,
    note: 'gitleaks: aws-access-token'
  },
  {
    id: 'jwt',
    keywords: ['eyj'],
    pattern: /\beyJ[A-Za-z0-9_-]{10,2048}\.eyJ[A-Za-z0-9_-]{10,2048}(?:\.[A-Za-z0-9_-]{10,2048})?/g,
    note: 'gitleaks: jwt (eyJ = base64url \'{"\')'
  },
  {
    id: 'bearer-token',
    keywords: ['bearer'],
    // [ \t] (not \s) so the token must sit on the same line as the scheme.
    pattern: /\b([Bb]earer[ \t]+)([A-Za-z0-9._~+/=-]{16,512})/g,
    maskGroup: 2,
    note: 'RFC 6750 bearer credentials; ordered after jwt so raw JWTs keep the jwt label'
  },
  {
    id: 'connection-string-password',
    keywords: ['password', 'pwd'],
    pattern: /\b((?:[Pp]assword|PASSWORD|[Pp]wd|PWD)\s*=\s*)([^;'"\s]{4,256})/g,
    maskGroup: 2,
    note: 'ADO/ODBC/JDBC connection strings'
  },
  {
    id: 'url-basic-auth',
    keywords: ['://'],
    pattern: /\b([a-z][a-z0-9+.-]{1,12}:\/\/[^/\s:@]{1,64}:)([^@/\s]{3,256})(?=@)/g,
    maskGroup: 2,
    note: 'URL userinfo password (scheme://user:password@host)'
  }
];

/**
 * OR of every rule pattern, flagless (safe for repeated .test() calls).
 * env-sanitizer derives its line-scoped value check from this, so the two
 * sanitizers share one corpus.
 */
export const SECRET_VALUE_ALTERNATION: RegExp = new RegExp(
  SECRET_VALUE_RULES.map(rule => `(?:${rule.pattern.source})`).join('|')
);

/**
 * Variable names whose values are masked outright (when non-trivial).
 * Normalized exact match — lowercase, non-alphanumerics stripped — NOT
 * substring: `tokenCount`, `PATH`, `patience` must stay debuggable. This is
 * deliberately stricter than env-sanitizer's substring key patterns: env-key
 * logging can afford aggressive matching, live variable inspection cannot.
 * Adapted from microsoft/DebugMCP (MIT).
 */
const SENSITIVE_NAME_SET = new Set([
  'apikey', 'apisecret', 'apitoken', 'accesskey', 'accesstoken', 'authtoken',
  'auth', 'authorization', 'authheader', 'bearertoken', 'clientsecret',
  'appsecret', 'connectionstring', 'connstr', 'credential', 'credentials',
  'dbpassword', 'encryptionkey', 'githubtoken', 'githubpat', 'gitlabtoken',
  'idtoken', 'masterkey', 'oauthtoken', 'passphrase', 'passwd', 'password',
  'pat', 'privatekey', 'pwd', 'refreshtoken', 'secret', 'secretkey',
  'sessiontoken', 'signingkey', 'slacktoken', 'token', 'awsaccesskeyid',
  'awssecretaccesskey', 'awssessiontoken'
]);

const SENSITIVE_NAME_RULE_ID = 'sensitive-name';

/**
 * Values never worth masking, so `password = None` stays debuggable ("why is
 * my token empty?" is a real debugging session). Checked after stripping one
 * layer of matching quotes (debugger reprs arrive quoted).
 */
const TRIVIAL_VALUES = new Set([
  'none', 'null', 'nil', 'undefined', 'true', 'false', '0', '1', '', '...',
  '<optimized out>', '<unavailable>'
]);

const WHOLE_PLACEHOLDER = /^<redacted:[a-z0-9-]+>$/;

const ALL_KEYWORDS: readonly string[] = [...new Set(SECRET_VALUE_RULES.flatMap(rule => rule.keywords))];

function placeholderFor(ruleId: string): string {
  return `<redacted:${ruleId}>`;
}

/**
 * Mask every well-known secret shape in `text`, replacing only the matched
 * token (or its secret capture group) with a labeled placeholder. Returns the
 * original string untouched (`redacted: false`) when nothing matched.
 */
export function redactSecretsInString(text: string): RedactionResult {
  if (!text) {
    return { value: text, hits: [], redacted: false };
  }
  let lower = text.toLowerCase();
  if (!ALL_KEYWORDS.some(keyword => lower.includes(keyword))) {
    return { value: text, hits: [], redacted: false };
  }

  let current = text;
  const hits: RedactionHit[] = [];
  for (const rule of SECRET_VALUE_RULES) {
    if (!rule.keywords.some(keyword => lower.includes(keyword))) {
      continue;
    }
    let count = 0;
    const replaced = current.replace(rule.pattern, (...args: unknown[]) => {
      count++;
      if (rule.maskGroup === undefined) {
        return placeholderFor(rule.id);
      }
      const kept = (args.slice(1, rule.maskGroup) as Array<string | undefined>)
        .filter((group): group is string => group !== undefined)
        .join('');
      return kept + placeholderFor(rule.id);
    });
    if (count > 0) {
      current = replaced;
      lower = current.toLowerCase();
      hits.push({ ruleId: rule.id, count });
    }
  }
  return { value: current, hits, redacted: hits.length > 0 };
}

/** Exact-match (normalized) check of a variable/property name. */
export function isSensitiveName(name: string): boolean {
  const normalized = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  return SENSITIVE_NAME_SET.has(normalized);
}

/** True for values not worth masking even under a sensitive name. */
export function isTrivialValue(value: string): boolean {
  let inner = value.trim();
  const quoted = /^(['"])([\s\S]*)\1$/.exec(inner);
  if (quoted) {
    inner = quoted[2];
  }
  return inner.length <= 4 || TRIVIAL_VALUES.has(inner.toLowerCase());
}

/**
 * Redact a single variable's value: value-shape pass always; then, when the
 * variable *name* is sensitive and the value is non-trivial (and not already
 * masked in full), the entire value is replaced — names like `password`
 * signal a secret regardless of its shape.
 */
export function redactVariableValue(name: string, value: string): RedactionResult {
  const shape = redactSecretsInString(value);
  if (
    isSensitiveName(name) &&
    !isTrivialValue(value) &&
    !WHOLE_PLACEHOLDER.test(shape.value.trim())
  ) {
    return {
      value: placeholderFor(SENSITIVE_NAME_RULE_ID),
      hits: [{ ruleId: SENSITIVE_NAME_RULE_ID, count: 1 }],
      redacted: true
    };
  }
  return shape;
}

/**
 * Assign an own enumerable property even for exotic key names ('__proto__'
 * would otherwise hit the prototype setter and vanish) — same guard as
 * env-sanitizer, duplicated here because env-sanitizer imports this module.
 */
function setOwnProperty(target: Record<string, unknown>, key: string, value: unknown): void {
  Object.defineProperty(target, key, { value, enumerable: true, writable: true, configurable: true });
}

/**
 * Value-shape pass over every string leaf of a payload (for raw DAP bodies
 * headed to logs). Never mutates the input; cycles become '[circular]'.
 */
export function redactSecretsDeep<T>(payload: T): { value: T; hits: RedactionHit[] } {
  const totals = new Map<string, number>();
  const value = redactDeep(payload, new WeakSet(), totals) as T;
  const hits = [...totals.entries()].map(([ruleId, count]) => ({ ruleId, count }));
  return { value, hits };
}

function redactDeep(value: unknown, ancestors: WeakSet<object>, totals: Map<string, number>): unknown {
  if (typeof value === 'string') {
    const result = redactSecretsInString(value);
    for (const hit of result.hits) {
      totals.set(hit.ruleId, (totals.get(hit.ruleId) ?? 0) + hit.count);
    }
    return result.value;
  }
  if (!value || typeof value !== 'object') {
    return value;
  }
  if (ancestors.has(value)) {
    return '[circular]';
  }
  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      return value.map(item => redactDeep(item, ancestors, totals));
    }
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      setOwnProperty(out, key, redactDeep(entry, ancestors, totals));
    }
    return out;
  } finally {
    ancestors.delete(value);
  }
}

/**
 * Generic notice for tool results whose items carry only `redacted` flags
 * (per-rule hit details are not retained past the masking point).
 */
export const REDACTION_NOTICE =
  'Values shown as <redacted:…> were masked because they matched known secret patterns ' +
  "or sensitive variable names. The program's real state is unchanged — placeholders are " +
  'display-only. Redaction is on by default; restart the server with DEBUG_MCP_NO_REDACT=1 ' +
  'to disable it.';

/**
 * One-line notice for tool results, telling the agent what was masked, that
 * the program state is unchanged, and how the user can opt out.
 */
export function buildRedactionNotice(hits: RedactionHit[]): string {
  const total = hits.reduce((sum, hit) => sum + hit.count, 0);
  const rules = hits.map(hit => hit.ruleId).join(', ');
  return (
    `${total} value(s) masked as <redacted:…> because they matched known secret patterns ` +
    `or sensitive variable names (rules: ${rules}). The program's real state is unchanged — ` +
    `placeholders are display-only. Redaction is on by default; restart the server with ` +
    `DEBUG_MCP_NO_REDACT=1 to disable it.`
  );
}
