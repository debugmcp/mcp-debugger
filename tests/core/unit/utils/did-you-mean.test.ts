import { describe, it, expect } from 'vitest';
import { didYouMean } from '../../../../src/utils/did-you-mean.js';

describe('didYouMean', () => {
  const validStrings = [
    'pathMappings',
    'justMyCode',
    'stopOnEntry',
    'args',
    'cwd',
    'env',
    'envFile'
  ];

  it('finds exact matches (distance 0)', () => {
    expect(didYouMean('pathMappings', validStrings)).toBe('pathMappings');
    expect(didYouMean('cwd', validStrings)).toBe('cwd');
  });

  it('suggests fixes for 1-edit typos', () => {
    // Missing character
    expect(didYouMean('pathMapping', validStrings)).toBe('pathMappings');
    // Extra character
    expect(didYouMean('justMyCodes', validStrings)).toBe('justMyCode');
    // Substituted character
    expect(didYouMean('stopOnEntri', validStrings)).toBe('stopOnEntry');
    // Case difference
    expect(didYouMean('pathmappings', validStrings)).toBe('pathMappings');
  });

  it('suggests fixes for 2-edit typos on normal-length keys', () => {
    // 'justMyCo' -> 'justMyCode' is 2 insertions
    expect(didYouMean('justMyCo', validStrings)).toBe('justMyCode');
  });

  it('returns null if no matches within threshold', () => {
    expect(didYouMean('completelyWrongKey', validStrings)).toBeNull();
    // Distance 3 is where misleading suggestions live — 'justMyC' is 3 edits
    // from 'justMyCode' and must not suggest it
    expect(didYouMean('justMyC', validStrings)).toBeNull();
  });

  it('applies stricter threshold for short strings', () => {
    // For length <= 4, threshold is 1
    // 'cwe' distance from 'cwd' is 1 -> match
    expect(didYouMean('cwe', validStrings)).toBe('cwd');

    // 'cw' distance from 'cwd' is 1 -> match
    expect(didYouMean('cw', validStrings)).toBe('cwd');

    // 'cx' distance from 'cwd' is 2 -> should return null because short strings have threshold 1
    expect(didYouMean('cx', validStrings)).toBeNull();

    // 'host' is a valid concept on other adapters, 2 edits from 'port' —
    // must never be suggested as a typo of it
    expect(didYouMean('host', ['port', 'address'])).toBeNull();
  });

  it('handles empty valid strings gracefully', () => {
    expect(didYouMean('test', [])).toBeNull();
  });
});
