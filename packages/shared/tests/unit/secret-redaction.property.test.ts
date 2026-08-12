/**
 * Property-based tests (fast-check) for secret-redaction.ts (issue #237).
 *
 * Example tests pin known tokens; these properties assert the invariants for
 * *generated* secrets across the whole corpus: every secret shape triggers
 * redaction and never survives, masking is context-independent (surrounding
 * text is untouched), idempotent, and the deep variant preserves structure
 * without mutating its input.
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  redactSecretsInString,
  redactSecretsDeep,
  redactVariableValue,
  isTrivialValue
} from '../../src/utils/secret-redaction.js';
import { tokenSecretValue, anySecretValue, filler } from './helpers/secret-arbitraries.js';

/**
 * Lowercase-only filler: cannot coincidentally form the uppercase-anchored
 * shapes (AKIA…, AIza…, SG., eyJ…) that the mixed-case `filler` could, so it
 * is safe for exact byte-identity assertions.
 */
const safeFiller = fc.string({
  unit: fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789 .,()'.split('')),
  maxLength: 20
});

describe('redactSecretsInString properties', () => {
  it('every generated secret triggers redaction and never survives, in any embedding', () => {
    fc.assert(
      fc.property(anySecretValue, filler, filler, (secret, pre, suf) => {
        for (const text of [secret, `${pre} ${secret} ${suf}`, `${pre}=${secret}${suf}`]) {
          const result = redactSecretsInString(text);
          expect(result.redacted).toBe(true);
          expect(result.value).not.toContain(secret);
          expect(result.hits.length).toBeGreaterThan(0);
        }
      })
    );
  });

  it('masking is context-independent: redacting an embedded token equals embedding the redacted token', () => {
    fc.assert(
      fc.property(tokenSecretValue, safeFiller, safeFiller, (secret, pre, suf) => {
        const alone = redactSecretsInString(secret);
        const embedded = redactSecretsInString(`${pre} ${secret} ${suf}`);
        expect(embedded.value).toBe(`${pre} ${alone.value} ${suf}`);
      })
    );
  });

  it('is idempotent for every corpus shape', () => {
    fc.assert(
      fc.property(anySecretValue, filler, filler, (secret, pre, suf) => {
        const once = redactSecretsInString(`${pre} ${secret} ${suf}`);
        const twice = redactSecretsInString(once.value);
        expect(twice.value).toBe(once.value);
      })
    );
  });
});

describe('redactVariableValue properties', () => {
  const sensitiveName = fc.constantFrom(
    'password', 'apiKey', 'client_secret', 'TOKEN', 'AWS_SECRET_ACCESS_KEY', 'connectionString'
  );

  it('non-trivial values of sensitive names never survive', () => {
    fc.assert(
      fc.property(sensitiveName, fc.string({ minLength: 5, maxLength: 60 }), (name, value) => {
        fc.pre(!isTrivialValue(value));
        const result = redactVariableValue(name, value);
        expect(result.redacted).toBe(true);
        expect(result.value).not.toContain(value);
      })
    );
  });
});

describe('redactSecretsDeep properties', () => {
  it('preserves structure, redacts every string leaf, and never mutates its input', () => {
    fc.assert(
      fc.property(tokenSecretValue, safeFiller, (secret, note) => {
        const payload = {
          command: 'variables',
          a: `${note} ${secret}`,
          b: [secret, 42, null, { nested: secret }],
          c: { d: note }
        };
        const snapshot = JSON.parse(JSON.stringify(payload));

        const { value, hits } = redactSecretsDeep(payload);

        expect(payload).toEqual(snapshot);
        expect(JSON.stringify(value)).not.toContain(secret);
        expect(hits.length).toBeGreaterThan(0);
        const out = value as typeof payload;
        expect(out.command).toBe('variables');
        expect(out.b[1]).toBe(42);
        expect(out.b[2]).toBe(null);
        expect(out.c.d).toBe(note);
      })
    );
  });
});
