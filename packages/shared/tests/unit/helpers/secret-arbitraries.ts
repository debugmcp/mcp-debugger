/**
 * Shared fast-check arbitraries for secret-shaped values.
 *
 * Single source for the generated token corpus, used by both sanitizer
 * property suites (env-sanitizer.property.test.ts and
 * secret-redaction.property.test.ts) so the two cannot drift apart:
 * the stderr sanitizer derives its value regex from the redaction rule
 * table, and these arbitraries generate against that same table.
 */
import fc from 'fast-check';

export const ALNUM = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
export const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export const charFrom = (chars: string) => fc.constantFrom(...chars.split(''));
export const stringOf = (chars: string, minLength: number, maxLength: number) =>
  fc.string({ unit: charFrom(chars), minLength, maxLength });

/** PEM private-key headers — multi-line blocks whose greedy body match may
 * absorb adjacent base64-ish text, so they are kept out of the token-shaped
 * arbitraries used for byte-identity properties. */
export const pemSecretValue = fc.constantFrom(
  '-----BEGIN RSA PRIVATE KEY-----',
  '-----BEGIN PRIVATE KEY-----'
);

/** Token shapes of the pre-#237 stderr corpus (mirrors the legacy
 * STDERR_SENSITIVE_VALUE coverage, minus PEM). */
export const legacyTokenSecretValue = fc.oneof(
  fc.tuple(fc.constantFrom('ghp_', 'gho_', 'ghu_', 'ghs_', 'ghr_'), stringOf(ALNUM, 20, 40))
    .map(([prefix, rest]) => prefix + rest),
  stringOf(ALNUM + '_', 20, 40).map(rest => `github_pat_${rest}`),
  stringOf(ALNUM + '_-', 20, 40).map(rest => `sk-${rest}`),
  fc.tuple(fc.constantFrom('xoxb-', 'xoxa-', 'xoxp-', 'xoxr-', 'xoxs-'), stringOf(ALNUM + '-', 10, 30))
    .map(([prefix, rest]) => prefix + rest),
  stringOf('0123456789' + UPPER, 16, 16).map(rest => `AKIA${rest}`)
);

/** Well-known secret value shapes of the original stderr corpus. */
export const secretValue = fc.oneof(legacyTokenSecretValue, pemSecretValue);

/** Token shapes added by the #237 redaction corpus (secret-redaction.ts). */
export const extendedTokenSecretValue = fc.oneof(
  stringOf(ALNUM + '_-', 35, 35).map(rest => `AIza${rest}`),
  fc.tuple(
    fc.constantFrom('sk_live_', 'sk_test_', 'rk_live_', 'rk_test_', 'pk_live_', 'pk_test_'),
    stringOf(ALNUM, 10, 40)
  ).map(([prefix, rest]) => prefix + rest),
  stringOf(ALNUM, 36, 36).map(rest => `npm_${rest}`),
  stringOf(ALNUM + '_-', 20, 50).map(rest => `glpat-${rest}`),
  stringOf(ALNUM, 30, 40).map(rest => `hf_${rest}`),
  stringOf(ALNUM + '_-', 20, 40).map(rest => `pypi-AgEIcHlwaS5vcmc${rest}`),
  fc.tuple(stringOf(ALNUM + '_-', 16, 64), stringOf(ALNUM + '_-', 16, 64))
    .map(([a, b]) => `SG.${a}.${b}`),
  fc.tuple(stringOf(ALNUM + '_-', 10, 30), stringOf(ALNUM + '_-', 10, 30), stringOf(ALNUM + '_-', 10, 30))
    .map(([h, p, s]) => `eyJ${h}.eyJ${p}.${s}`)
);

/** Every token-shaped secret (safe for byte-identity assertions). */
export const tokenSecretValue = fc.oneof(legacyTokenSecretValue, extendedTokenSecretValue);

/** The whole corpus, PEM included. */
export const anySecretValue = fc.oneof(tokenSecretValue, pemSecretValue);

/** Newline-free filler that cannot span lines. May coincidentally look sensitive — that's fine. */
export const filler = fc.string({ unit: charFrom(ALNUM + ' .,()[]/'), maxLength: 20 });

/**
 * A line embedding a secret from the whole corpus (legacy + #237 shapes).
 * The prefix always ends at a word boundary (space, '=', ':' or nothing),
 * matching how secrets actually appear in stderr: bare, or as
 * `SOME_KEY=<secret>` assignments.
 */
export const lineWithSecret = fc
  .tuple(
    fc.oneof(fc.constant(''), filler.map(s => `${s} `), filler.map(s => `${s}=`), filler.map(s => `${s}:`)),
    anySecretValue,
    filler
  )
  .map(([prefix, secret, suffix]) => ({ line: prefix + secret + suffix, secret: secret as string | null }));

export const benignLine = filler.map(line => ({ line, secret: null as string | null }));

export const mixedLines = fc.array(fc.oneof(benignLine, lineWithSecret), { maxLength: 15 });
