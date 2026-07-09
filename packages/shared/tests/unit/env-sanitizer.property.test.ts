/**
 * Property-based tests (fast-check) for env-sanitizer.ts.
 *
 * The sanitizers are the last line of defense against secrets leaking into
 * logs and MCP tool errors (issues #146, #151, #153). Example-based tests
 * pin known cases; these properties assert the invariants for *generated*
 * secrets: no secret-shaped value survives sanitization, structure is
 * preserved, and sanitization is idempotent.
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  sanitizeEnvForLogging,
  sanitizePayloadForLogging,
  sanitizeStderr,
  sanitizeStderrTail
} from '../../src/utils/env-sanitizer.js';

const REDACTED_LINE = '[REDACTED — line contained sensitive data]';

const ALNUM = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

const charFrom = (chars: string) => fc.constantFrom(...chars.split(''));
const stringOf = (chars: string, minLength: number, maxLength: number) =>
  fc.string({ unit: charFrom(chars), minLength, maxLength });

/** Well-known secret value shapes (mirrors STDERR_SENSITIVE_VALUE coverage). */
const secretValue = fc.oneof(
  fc.tuple(fc.constantFrom('ghp_', 'gho_', 'ghu_', 'ghs_', 'ghr_'), stringOf(ALNUM, 20, 40))
    .map(([prefix, rest]) => prefix + rest),
  stringOf(ALNUM + '_', 20, 40).map(rest => `github_pat_${rest}`),
  stringOf(ALNUM + '_-', 20, 40).map(rest => `sk-${rest}`),
  fc.tuple(fc.constantFrom('xoxb-', 'xoxa-', 'xoxp-', 'xoxr-', 'xoxs-'), stringOf(ALNUM + '-', 10, 30))
    .map(([prefix, rest]) => prefix + rest),
  stringOf('0123456789' + UPPER, 16, 16).map(rest => `AKIA${rest}`),
  fc.constant('-----BEGIN RSA PRIVATE KEY-----'),
  fc.constant('-----BEGIN PRIVATE KEY-----')
);

/** Newline-free filler that cannot span lines. May coincidentally look sensitive — that's fine. */
const filler = fc.string({ unit: charFrom(ALNUM + ' .,()[]/'), maxLength: 20 });

/**
 * A line embedding a secret. The prefix always ends at a word boundary
 * (space, '=', ':' or nothing), matching how secrets actually appear in
 * stderr: bare, or as `SOME_KEY=<secret>` assignments.
 */
const lineWithSecret = fc
  .tuple(
    fc.oneof(fc.constant(''), filler.map(s => `${s} `), filler.map(s => `${s}=`), filler.map(s => `${s}:`)),
    secretValue,
    filler
  )
  .map(([prefix, secret, suffix]) => ({ line: prefix + secret + suffix, secret: secret as string | null }));

const benignLine = filler.map(line => ({ line, secret: null as string | null }));

const mixedLines = fc.array(fc.oneof(benignLine, lineWithSecret), { maxLength: 15 });

describe('sanitizeStderr properties', () => {
  it('preserves line count and only ever substitutes the redaction marker', () => {
    fc.assert(
      fc.property(mixedLines, (entries) => {
        const output = sanitizeStderr(entries.map(e => e.line));
        expect(output).toHaveLength(entries.length);
        output.forEach((line, i) => {
          expect([entries[i].line, REDACTED_LINE]).toContain(line);
        });
      })
    );
  });

  it('no generated secret survives, wherever it sits on the line', () => {
    fc.assert(
      fc.property(mixedLines, (entries) => {
        const output = sanitizeStderr(entries.map(e => e.line));
        entries.forEach((entry, i) => {
          if (entry.secret !== null) {
            expect(output[i]).toBe(REDACTED_LINE);
          }
        });
      })
    );
  });

  it('is idempotent', () => {
    fc.assert(
      fc.property(mixedLines, (entries) => {
        const once = sanitizeStderr(entries.map(e => e.line));
        expect(sanitizeStderr(once)).toEqual(once);
      })
    );
  });
});

describe('sanitizeStderrTail properties', () => {
  it('no secret survives and the output respects the line/char bounds', () => {
    fc.assert(
      fc.property(
        mixedLines,
        fc.integer({ min: 1, max: 8 }),
        fc.integer({ min: 10, max: 120 }),
        (entries, maxLines, maxChars) => {
          const text = entries.map(e => e.line).join('\n');
          const output = sanitizeStderrTail(text, { maxLines, maxChars });

          for (const entry of entries) {
            if (entry.secret !== null) {
              expect(output).not.toContain(entry.secret);
            }
          }
          // tail.join('\n') plus a same-line "(last N of M lines)" label
          expect(output.split('\n').length).toBeLessThanOrEqual(maxLines);
          // maxChars cap + ellipsis + label slack
          expect(output.length).toBeLessThanOrEqual(maxChars + 40);
        }
      )
    );
  });
});

describe('sanitizeEnvForLogging properties', () => {
  const SENSITIVE_BASES = [
    'API_KEY', 'APIKEY', 'TOKEN', 'SECRET', 'PASSWORD', 'PASSWD', 'CREDENTIAL',
    'PRIVATE_KEY', 'AUTH', 'SESSION_ID', 'ACCESS_KEY', 'SIGNING', 'PAT', 'KEY',
    'PWD', 'BEARER', 'OAUTH', 'JWT', 'CRED'
  ];

  /** A key that must be redacted, optionally wrapped in arbitrary '_'-joined words. */
  const sensitiveKey = fc
    .tuple(
      fc.option(stringOf(UPPER, 1, 6), { nil: undefined }),
      fc.constantFrom(...SENSITIVE_BASES),
      fc.option(stringOf(UPPER, 1, 6), { nil: undefined })
    )
    .map(parts => parts.filter((p): p is string => p !== undefined).join('_'));

  it('every key containing a sensitive marker is redacted; its value never leaks', () => {
    fc.assert(
      fc.property(
        fc.dictionary(sensitiveKey, fc.string({ minLength: 1 }), { minKeys: 1, maxKeys: 8 }),
        (env) => {
          const output = sanitizeEnvForLogging(env);
          expect(Object.keys(output).sort()).toEqual(Object.keys(env).sort());
          for (const key of Object.keys(env)) {
            expect(output[key]).toBe('[REDACTED]');
          }
        }
      )
    );
  });

  // Exotic keys are always in the pool: '__proto__' found a real bug here
  // (plain assignment routed it to the prototype setter and dropped the entry).
  const envKey = fc.oneof(
    stringOf(ALNUM + '_-', 1, 20),
    fc.constantFrom('__proto__', 'constructor', 'hasOwnProperty', 'toString')
  );

  it('preserves the key set, passes values through or redacts them, and is idempotent', () => {
    fc.assert(
      fc.property(
        fc.dictionary(envKey, fc.string(), { maxKeys: 10 }),
        (env) => {
          const output = sanitizeEnvForLogging(env);
          expect(Object.keys(output).sort()).toEqual(Object.keys(env).sort());
          for (const key of Object.keys(env)) {
            expect([env[key], '[REDACTED]']).toContain(output[key]);
          }
          expect(sanitizeEnvForLogging(output)).toEqual(output);
        }
      )
    );
  });

  it('keeps a literal __proto__ env var as an own property (regression)', () => {
    const env = JSON.parse('{"__proto__": "shady-value", "PATH": "/usr/bin"}') as Record<string, string>;
    const output = sanitizeEnvForLogging(env);
    expect(Object.keys(output).sort()).toEqual(['PATH', '__proto__']);
    expect(Object.getOwnPropertyDescriptor(output, '__proto__')?.value).toBe('shady-value');
    expect(Object.getPrototypeOf(output)).toBe(Object.prototype);
  });
});

describe('sanitizePayloadForLogging properties', () => {
  const SENTINEL = 'SECRET_ENV_VALUE_SENTINEL';

  const envObject = fc.dictionary(stringOf(ALNUM + '_', 1, 10), fc.constant(SENTINEL), {
    minKeys: 1,
    maxKeys: 5
  });

  it('replaces every env object at any depth; no env value ever survives', () => {
    fc.assert(
      fc.property(envObject, fc.option(envObject, { nil: undefined }), filler, (env, nestedEnv, extra) => {
        const payload = {
          command: 'launch',
          arguments: {
            env,
            extra,
            targets: [{ name: 'child', launchConfig: nestedEnv === undefined ? {} : { env: nestedEnv } }]
          }
        };

        const output = sanitizePayloadForLogging(payload) as {
          command: string;
          arguments: { env: unknown; extra: string; targets: Array<{ launchConfig: { env?: unknown } }> };
        };

        expect(JSON.stringify(output)).not.toContain(SENTINEL);
        expect(output.arguments.env).toBe(`<${Object.keys(env).length} env vars redacted>`);
        if (nestedEnv !== undefined) {
          expect(output.arguments.targets[0].launchConfig.env).toBe(
            `<${Object.keys(nestedEnv).length} env vars redacted>`
          );
        }
        // Everything that is not an env object passes through untouched.
        expect(output.command).toBe('launch');
        expect(output.arguments.extra).toBe(extra);
      })
    );
  });
});
