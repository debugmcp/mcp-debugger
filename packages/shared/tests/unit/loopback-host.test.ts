/**
 * isLoopbackHost (issue #903): the one loopback answer behind attach locality.
 */
import { describe, it, expect } from 'vitest';
import { isLoopbackHost } from '../../src/utils/loopback-host.js';

describe('isLoopbackHost', () => {
  it.each([
    'localhost',
    'LOCALHOST',
    ' localhost ',
    '127.0.0.1',
    '127.1.2.3',
    '127.255.255.255',
    '::1',
    '[::1]',
    '::ffff:127.0.0.1',
    '[::ffff:127.0.0.1]'
  ])('accepts %j', (host) => {
    expect(isLoopbackHost(host)).toBe(true);
  });

  it.each([
    '0.0.0.0',
    '10.0.0.5',
    '128.0.0.1',
    '127.0.0.256',
    '127.0.0',
    'debug-pod',
    'localhost.example.com',
    '::ffff:10.0.0.1',
    '::2',
    '',
    '   ',
    undefined,
    null
  ])('rejects %j', (host) => {
    expect(isLoopbackHost(host as string | undefined | null)).toBe(false);
  });
});
