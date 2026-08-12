/**
 * Unit tests for secret-redaction.ts (issue #237).
 *
 * The redaction engine masks credential-shaped values in debugger tool
 * results (get_variables, evaluate_expression, output capture) before they
 * reach the AI agent. Unlike the whole-line stderr sanitizer, replacement is
 * per-token and labeled, so the surrounding value stays legible.
 */
import { describe, it, expect } from 'vitest';
import {
  SECRET_VALUE_RULES,
  SECRET_VALUE_ALTERNATION,
  redactSecretsInString,
  isSensitiveName,
  isTrivialValue,
  redactVariableValue,
  redactSecretsDeep,
  buildRedactionNotice
} from '../../src/utils/secret-redaction.js';

const mask = (id: string) => `<redacted:${id}>`;

/**
 * One realistic dummy token per whole-match rule. maskGroup rules (bearer,
 * connection strings, URL userinfo) and the multi-line PEM rule get
 * dedicated tests below.
 *
 * Every token is built by concatenation so GitHub push protection never sees
 * a scannable secret-shaped literal in this file's blob (it flags realistic
 * fixtures — Stripe, Slack, Hugging Face — as real keys).
 */
const WHOLE_MATCH_CASES: Array<{ ruleId: string; token: string }> = [
  { ruleId: 'github-pat', token: 'ghp_' + 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef0123' },
  { ruleId: 'github-pat', token: 'gho_' + '0123456789abcdefghij0123456789' },
  { ruleId: 'github-fine-grained-pat', token: 'github_pat_' + '11ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789' },
  { ruleId: 'openai-style-key', token: 'sk-' + 'proj-abcdefghijklmnopqrstuvwxyz012345' },
  { ruleId: 'openai-style-key', token: 'sk-' + 'ant-api03-abcdefghijklmnopqrstuv' },
  { ruleId: 'stripe-key', token: 'sk_live_' + '4eC39HqLyjWDarjtT1zdp7dc' },
  { ruleId: 'slack-token', token: 'xoxb-' + '123456789012-abcdefghijklmnop' },
  { ruleId: 'aws-access-key-id', token: 'AKIA' + 'IOSFODNN7EXAMPLE' },
  { ruleId: 'aws-access-key-id', token: 'ASIA' + 'IOSFODNN7EXAMPLE' },
  { ruleId: 'google-api-key', token: 'AIza' + 'SyA1234567890abcdefghijklmnopqrstuv' },
  { ruleId: 'gitlab-pat', token: 'glpat-' + 'ABCDEFGHIJKLMNOPQRST' },
  { ruleId: 'npm-token', token: 'npm_' + 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789' },
  { ruleId: 'pypi-token', token: 'pypi-' + 'AgEIcHlwaS5vcmcCJDAxMjM0NTY3ODkwMTIzNDU2Nzg5' },
  { ruleId: 'huggingface-token', token: 'hf_' + 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefgh' },
  { ruleId: 'sendgrid-key', token: 'SG.' + 'abcdefghijklmnop.qrstuvwxyz0123456789ABCDEF' },
  { ruleId: 'jwt', token: 'eyJ' + 'hbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5NxXgL0n3I9PlFUP0THsR8U' }
];

/** Values that must never be touched (over-redaction guards). */
const BENIGN_STRINGS = [
  'Starting debugger on port 5678',
  'sk-only-short',                       // sk- tail below length floor
  'ghp_short',                           // gh*_ tail below length floor
  'AKIATOOSHORT',                        // AKIA but not 16 uppercase/digits
  'tokenCount = 42',
  'PATH=/usr/bin:/usr/local/bin',
  'https://example.com/path?query=1',    // URL without userinfo
  'Bearer of bad news',                  // bearer followed by short words
  'the task-abcdefghijklmnopqrstuvwxyz item' // 'sk-' inside 'task-' must not anchor
];

describe('redactSecretsInString', () => {
  it.each(WHOLE_MATCH_CASES)('masks $ruleId token as a labeled placeholder', ({ ruleId, token }) => {
    const input = `The value is ${token} right here.`;
    const result = redactSecretsInString(input);
    expect(result.value).toBe(`The value is ${mask(ruleId)} right here.`);
    expect(result.redacted).toBe(true);
    expect(result.hits).toEqual([{ ruleId, count: 1 }]);
  });

  it('masks PEM private key blocks including body and END line', () => {
    const pem = '-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA7bq0\nqqB4kp1Z\n-----END RSA PRIVATE KEY-----';
    const result = redactSecretsInString(`cert: ${pem} (loaded)`);
    expect(result.value).toBe(`cert: ${mask('pem-private-key')} (loaded)`);
    expect(result.hits).toEqual([{ ruleId: 'pem-private-key', count: 1 }]);
  });

  it('masks JSON-escaped PEM blocks (GCP service-account style, literal \\n)', () => {
    const value = '{"private_key": "-----BEGIN PRIVATE KEY-----\\nMIIEvQIBADAN\\n-----END PRIVATE KEY-----\\n"}';
    const result = redactSecretsInString(value);
    expect(result.value).not.toContain('MIIEvQIBADAN');
    expect(result.value).toContain(mask('pem-private-key'));
    expect(result.value).toContain('"private_key"');
  });

  it('masks a bare PEM header even without a body (stderr corpus compatibility)', () => {
    const result = redactSecretsInString('-----BEGIN RSA PRIVATE KEY-----');
    expect(result.value).toBe(mask('pem-private-key'));
  });

  it('masks only the token after "Bearer", keeping the scheme word', () => {
    const result = redactSecretsInString('Authorization: Bearer abc123def456ghi789jkl');
    expect(result.value).toBe(`Authorization: Bearer ${mask('bearer-token')}`);
    expect(result.hits).toEqual([{ ruleId: 'bearer-token', count: 1 }]);
  });

  it('masks only the password in connection strings, keeping the key and other pairs', () => {
    const result = redactSecretsInString('Server=db;User Id=sa;Password=Sup3rS3cret!;Encrypt=true');
    expect(result.value).toBe(`Server=db;User Id=sa;Password=${mask('connection-string-password')};Encrypt=true`);
    expect(result.hits).toEqual([{ ruleId: 'connection-string-password', count: 1 }]);
  });

  it('masks only the password in URL userinfo, keeping scheme, user and host', () => {
    const result = redactSecretsInString('postgres://admin:s3cretpw@db.example.com:5432/app');
    expect(result.value).toBe(`postgres://admin:${mask('url-basic-auth')}@db.example.com:5432/app`);
    expect(result.hits).toEqual([{ ruleId: 'url-basic-auth', count: 1 }]);
  });

  it.each(BENIGN_STRINGS.map(s => [s]))('leaves benign string untouched: %s', (input) => {
    const result = redactSecretsInString(input);
    expect(result.value).toBe(input);
    expect(result.redacted).toBe(false);
    expect(result.hits).toEqual([]);
  });

  it('returns empty input unchanged', () => {
    const result = redactSecretsInString('');
    expect(result.value).toBe('');
    expect(result.redacted).toBe(false);
  });

  it('aggregates repeated matches of one rule into a single hit with a count', () => {
    const a = 'ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef0123';
    const b = 'ghp_0123456789abcdefghijklmnopqrstuv0123';
    const result = redactSecretsInString(`first ${a} second ${b}`);
    expect(result.value).toBe(`first ${mask('github-pat')} second ${mask('github-pat')}`);
    expect(result.hits).toEqual([{ ruleId: 'github-pat', count: 2 }]);
  });

  it('reports one hit entry per distinct rule', () => {
    const result = redactSecretsInString(
      "env = {'GITHUB_PAT': 'ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef0123', 'AWS_ACCESS_KEY_ID': 'AKIAIOSFODNN7EXAMPLE'}"
    );
    expect(result.value).toContain(mask('github-pat'));
    expect(result.value).toContain(mask('aws-access-key-id'));
    expect(result.value).toContain("'GITHUB_PAT'"); // dict keys survive
    expect(result.hits).toHaveLength(2);
  });

  it('does not re-trigger on its own placeholders (idempotence)', () => {
    const placeholder = `value ${mask('github-pat')} tail`;
    const result = redactSecretsInString(placeholder);
    expect(result.value).toBe(placeholder);
    expect(result.redacted).toBe(false);
  });

  it.each(WHOLE_MATCH_CASES)('is idempotent for $ruleId', ({ token }) => {
    const once = redactSecretsInString(`x = '${token}'`);
    const twice = redactSecretsInString(once.value);
    expect(twice.value).toBe(once.value);
  });
});

describe('isSensitiveName', () => {
  it.each([
    ['password'], ['PASSWORD'], ['API_KEY'], ['apiKey'], ['clientSecret'],
    ['client_secret'], ['GITHUB_TOKEN'], ['auth_token'], ['connectionString'],
    ['AWS_SECRET_ACCESS_KEY'], ['pat'], ['token']
  ])('matches %s', (name) => {
    expect(isSensitiveName(name)).toBe(true);
  });

  it.each([
    ['tokenCount'], ['PATH'], ['PATTERN'], ['KEYBOARD'], ['MONKEY'],
    ['patience'], ['keyboardEvent'], ['authorTag'], ['secretsManagerClient'], ['i']
  ])('does not match %s (exact, not substring)', (name) => {
    expect(isSensitiveName(name)).toBe(false);
  });
});

describe('isTrivialValue', () => {
  it.each([
    ['None'], ['null'], ['nil'], ['undefined'], ['true'], ['False'], ['0'], ['1'],
    [''], ['...'], ['<optimized out>'], ['<unavailable>'], ['ab'],
    ["'None'"], ['"none"'], ["''"]
  ])('treats %s as trivial', (value) => {
    expect(isTrivialValue(value)).toBe(true);
  });

  it.each([['hunter2blue'], ['s3cretpw!'], ["'some real value'"]])(
    'treats %s as non-trivial',
    (value) => {
      expect(isTrivialValue(value)).toBe(false);
    }
  );
});

describe('redactVariableValue', () => {
  it('masks a GitHub PAT held in a variable, keeping the repr quotes (acceptance #237a)', () => {
    const result = redactVariableValue('gh_token', "'ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef0123'");
    expect(result.value).toBe(`'${mask('github-pat')}'`);
    expect(result.redacted).toBe(true);
    expect(result.hits).toEqual([{ ruleId: 'github-pat', count: 1 }]);
  });

  it('masks secrets embedded in JSON-shaped variable values, keeping other fields', () => {
    const result = redactVariableValue(
      'config',
      '{"github_token": "ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef0123", "region": "us-east-1"}'
    );
    expect(result.value).toContain(mask('github-pat'));
    expect(result.value).toContain('"region": "us-east-1"');
  });

  it('masks the whole value when the variable name is sensitive and the value is non-trivial', () => {
    const result = redactVariableValue('password', 'hunter2blue');
    expect(result.value).toBe(mask('sensitive-name'));
    expect(result.hits).toEqual([{ ruleId: 'sensitive-name', count: 1 }]);
  });

  it('does not double-mask when a value-shape rule already masked the whole value', () => {
    const result = redactVariableValue('token', 'ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef0123');
    expect(result.value).toBe(mask('github-pat'));
    expect(result.hits).toEqual([{ ruleId: 'github-pat', count: 1 }]);
  });

  it('leaves trivial values of sensitive names untouched (debuggability)', () => {
    for (const value of ['None', "''", 'undefined', '0', 'null']) {
      const result = redactVariableValue('password', value);
      expect(result.value).toBe(value);
      expect(result.redacted).toBe(false);
    }
  });

  it('leaves non-sensitive names with benign values untouched', () => {
    for (const [name, value] of [
      ['tokenCount', '42'],
      ['PATH', '/usr/bin:/usr/local/bin'],
      ['patience', 'high'],
      ['keyboardEvent', "{type: 'keydown'}"]
    ] as const) {
      const result = redactVariableValue(name, value);
      expect(result.value).toBe(value);
      expect(result.redacted).toBe(false);
    }
  });
});

describe('redactSecretsDeep', () => {
  it('masks string leaves at any depth, preserves structure, and never mutates input', () => {
    const input = {
      command: 'variables',
      body: {
        variables: [
          { name: 'gh', value: "'ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef0123'" },
          { name: 'n', value: 42 }
        ]
      },
      tags: ['AKIAIOSFODNN7EXAMPLE', 'clean']
    };
    const snapshot = JSON.parse(JSON.stringify(input));

    const { value, hits } = redactSecretsDeep(input);

    expect(input).toEqual(snapshot); // input untouched
    const out = value as typeof input;
    expect(out.body.variables[0].value).toBe(`'${mask('github-pat')}'`);
    expect(out.body.variables[1].value).toBe(42);
    expect(out.tags[0]).toBe(mask('aws-access-key-id'));
    expect(out.tags[1]).toBe('clean');
    expect(out.command).toBe('variables');
    expect(hits).toEqual(
      expect.arrayContaining([
        { ruleId: 'github-pat', count: 1 },
        { ruleId: 'aws-access-key-id', count: 1 }
      ])
    );
  });

  it('survives circular structures without throwing', () => {
    const payload: Record<string, unknown> = { note: 'ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef0123' };
    payload.self = payload;
    const { value } = redactSecretsDeep(payload);
    expect((value as Record<string, unknown>).note).toBe(mask('github-pat'));
  });
});

describe('buildRedactionNotice', () => {
  it('names the rules, totals the count, and points at the opt-out flag', () => {
    const notice = buildRedactionNotice([
      { ruleId: 'github-pat', count: 2 },
      { ruleId: 'sensitive-name', count: 1 }
    ]);
    expect(notice).toContain('3');
    expect(notice).toContain('github-pat');
    expect(notice).toContain('sensitive-name');
    expect(notice).toContain('DEBUG_MCP_NO_REDACT=1');
  });
});

describe('SECRET_VALUE_RULES / SECRET_VALUE_ALTERNATION', () => {
  it('every rule carries at least one lowercase keyword anchor', () => {
    expect(SECRET_VALUE_RULES.length).toBeGreaterThanOrEqual(15);
    for (const rule of SECRET_VALUE_RULES) {
      expect(rule.keywords.length, rule.id).toBeGreaterThan(0);
      for (const keyword of rule.keywords) {
        expect(keyword, rule.id).toBe(keyword.toLowerCase());
      }
    }
  });

  it('rule ids are unique and never themselves retrigger a rule', () => {
    const ids = SECRET_VALUE_RULES.map(r => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(redactSecretsInString(mask(id)).redacted, id).toBe(false);
    }
  });

  it('the derived alternation matches every corpus token and is safe to reuse (no lastIndex state)', () => {
    for (const { token } of WHOLE_MATCH_CASES) {
      const line = `some prefix ${token} some suffix`;
      expect(SECRET_VALUE_ALTERNATION.test(line), token).toBe(true);
      expect(SECRET_VALUE_ALTERNATION.test(line), `${token} (second call)`).toBe(true);
    }
    expect(SECRET_VALUE_ALTERNATION.test('PATH=/usr/bin')).toBe(false);
  });
});
