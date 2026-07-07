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

  it('redacts token-delimited sensitive keys like GITHUB_PAT (issue #146)', () => {
    const env = {
      GITHUB_PAT: 'github_pat_abc123',
      MY_PWD: 'x',
      SSH_KEY: 'y',
      AWS_ACCESS_KEY_ID: 'z',
      githubPat: 'camel'
    };
    const result = sanitizeEnvForLogging(env);
    expect(result.GITHUB_PAT).toBe('[REDACTED]');
    expect(result.MY_PWD).toBe('[REDACTED]');
    expect(result.SSH_KEY).toBe('[REDACTED]');
    expect(result.AWS_ACCESS_KEY_ID).toBe('[REDACTED]');
    expect(result.githubPat).toBe('[REDACTED]');
  });

  it('does not over-redact keys where a token is a mere substring', () => {
    const env = { PATH: '/usr/bin', PATTERN: '*.ts', KEYBOARD: 'us', MONKEY: 'banana' };
    const result = sanitizeEnvForLogging(env);
    expect(result).toEqual(env);
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

  it('replaces adapterCommand.env with a count summary — no values logged (issue #146)', () => {
    const payload = {
      sessionId: 'abc',
      adapterCommand: {
        command: 'python',
        args: ['-m', 'debugpy'],
        env: { HOME: '/home/user', API_KEY: 'secret-value', GITHUB_PAT: 'github_pat_XYZ' }
      }
    };
    const result = sanitizePayloadForLogging(payload) as any;
    expect(result.adapterCommand.env).toBe('<3 env vars redacted>');
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('/home/user');
    expect(serialized).not.toContain('secret-value');
    expect(serialized).not.toContain('github_pat_XYZ');
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

  it('redacts lines with extended key patterns like GITHUB_PAT= without touching PATH=', () => {
    const result = sanitizeStderr(['GITHUB_PAT=github_pat_abc', 'PATH=/usr/bin']);
    expect(result[0]).toBe('[REDACTED — line contained sensitive data]');
    expect(result[1]).toBe('PATH=/usr/bin');
  });

  it('redacts lines containing bare secret-shaped values (issue #146)', () => {
    const lines = [
      "env dump: { FOO: 'ghp_0123456789abcdefghij0123456789' }",
      'github_pat_11ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
      'aws AKIAIOSFODNN7EXAMPLE',
      'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0In0.sig',
      '-----BEGIN RSA PRIVATE KEY-----',
      'plain informational line'
    ];
    const result = sanitizeStderr(lines);
    expect(result[0]).toBe('[REDACTED — line contained sensitive data]');
    expect(result[1]).toBe('[REDACTED — line contained sensitive data]');
    expect(result[2]).toBe('[REDACTED — line contained sensitive data]');
    expect(result[3]).toBe('[REDACTED — line contained sensitive data]');
    expect(result[4]).toBe('[REDACTED — line contained sensitive data]');
    expect(result[5]).toBe('plain informational line');
  });

  it('handles empty array', () => {
    expect(sanitizeStderr([])).toEqual([]);
  });
});
