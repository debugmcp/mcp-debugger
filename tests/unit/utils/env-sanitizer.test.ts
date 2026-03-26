/**
 * Unit tests for env-sanitizer.ts
 */
import { describe, it, expect } from 'vitest';
import {
  sanitizeEnvForLogging,
  sanitizePayloadForLogging,
  sanitizeStderr
} from '../../../src/utils/env-sanitizer.js';

describe('sanitizeEnvForLogging', () => {
  it('redacts keys matching sensitive patterns', () => {
    const env = {
      API_KEY: 'secret-value',
      SECRET_TOKEN: 'my-token',
      PASSWORD: 'hunter2',
      CREDENTIAL_FILE: '/path/to/creds',
      PRIVATE_KEY: 'base64data',
      AUTH_HEADER: 'Bearer xyz',
      SESSION_ID: 'abc123',
      ACCESS_KEY: 'AKIA...',
      SIGNING_KEY: 'hmac-key'
    };
    const result = sanitizeEnvForLogging(env);
    for (const key of Object.keys(env)) {
      expect(result[key]).toBe('[REDACTED]');
    }
  });

  it('passes through non-sensitive keys', () => {
    const env = {
      HOME: '/home/user',
      PATH: '/usr/bin',
      NODE_ENV: 'production',
      DEBUG: 'true'
    };
    const result = sanitizeEnvForLogging(env);
    expect(result).toEqual(env);
  });

  it('handles mixed sensitive and non-sensitive keys', () => {
    const env = {
      HOME: '/home/user',
      API_KEY: 'secret',
      NODE_ENV: 'test'
    };
    const result = sanitizeEnvForLogging(env);
    expect(result.HOME).toBe('/home/user');
    expect(result.API_KEY).toBe('[REDACTED]');
    expect(result.NODE_ENV).toBe('test');
  });

  it('handles empty env object', () => {
    expect(sanitizeEnvForLogging({})).toEqual({});
  });

  it('is case-insensitive for pattern matching', () => {
    const env = { api_key: 'val', Api_Key: 'val', apiKey: 'val' };
    const result = sanitizeEnvForLogging(env);
    expect(result.api_key).toBe('[REDACTED]');
    expect(result.Api_Key).toBe('[REDACTED]');
    expect(result.apiKey).toBe('[REDACTED]');
  });
});

describe('sanitizePayloadForLogging', () => {
  it('returns null/undefined/primitives as-is', () => {
    expect(sanitizePayloadForLogging(null)).toBe(null);
    expect(sanitizePayloadForLogging(undefined)).toBe(undefined);
    expect(sanitizePayloadForLogging(42)).toBe(42);
    expect(sanitizePayloadForLogging('hello')).toBe('hello');
  });

  it('returns object without adapterCommand unchanged', () => {
    const payload = { sessionId: 'abc', language: 'python' };
    const result = sanitizePayloadForLogging(payload) as Record<string, unknown>;
    expect(result.sessionId).toBe('abc');
    expect(result.language).toBe('python');
  });

  it('sanitizes adapterCommand.env', () => {
    const payload = {
      sessionId: 'abc',
      adapterCommand: {
        command: 'python',
        args: ['-m', 'debugpy'],
        env: { HOME: '/home/user', API_KEY: 'secret-value' }
      }
    };
    const result = sanitizePayloadForLogging(payload) as any;
    expect(result.adapterCommand.env.HOME).toBe('/home/user');
    expect(result.adapterCommand.env.API_KEY).toBe('[REDACTED]');
  });

  it('handles adapterCommand without env', () => {
    const payload = {
      adapterCommand: { command: 'python', args: [] }
    };
    const result = sanitizePayloadForLogging(payload) as any;
    expect(result.adapterCommand.command).toBe('python');
  });

  it('handles adapterCommand that is not an object', () => {
    const payload = { adapterCommand: 'not-an-object' };
    const result = sanitizePayloadForLogging(payload) as any;
    expect(result.adapterCommand).toBe('not-an-object');
  });

  it('does not mutate the original payload', () => {
    const payload = {
      adapterCommand: {
        command: 'python',
        env: { API_KEY: 'secret' }
      }
    };
    sanitizePayloadForLogging(payload);
    expect((payload.adapterCommand.env as any).API_KEY).toBe('secret');
  });
});

describe('sanitizeStderr', () => {
  it('redacts lines containing sensitive assignments', () => {
    const lines = [
      'ANTHROPIC_API_KEY=sk-ant-abc123',
      'Starting debugger...',
      '"OPENAI_API_KEY": "sk-..."',
      'password="hunter2"',
      'auth_token: xyz'
    ];
    const result = sanitizeStderr(lines);
    expect(result[0]).toBe('[REDACTED — line contained sensitive data]');
    expect(result[1]).toBe('Starting debugger...');
    expect(result[2]).toBe('[REDACTED — line contained sensitive data]');
    expect(result[3]).toBe('[REDACTED — line contained sensitive data]');
    expect(result[4]).toBe('[REDACTED — line contained sensitive data]');
  });

  it('passes through clean lines', () => {
    const lines = ['Loading module...', 'Server started on port 3000', ''];
    expect(sanitizeStderr(lines)).toEqual(lines);
  });

  it('handles empty array', () => {
    expect(sanitizeStderr([])).toEqual([]);
  });
});
