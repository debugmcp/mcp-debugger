import { describe, it, expect } from 'vitest';

import { parseEnvBool, determineVendoringPlan } from '../../scripts/lib/vendor-strategy';

describe('vendor-strategy: parseEnvBool', () => {
  it('returns true only for "true" (case-insensitive) strings', () => {
    expect(parseEnvBool('true')).toBe(true);
    expect(parseEnvBool('TRUE')).toBe(true);
    expect(parseEnvBool('TrUe')).toBe(true);
    expect(parseEnvBool(' false ')).toBe(false);
    expect(parseEnvBool('1')).toBe(false);
    expect(parseEnvBool(1 as unknown as string)).toBe(false);
    expect(parseEnvBool(undefined)).toBe(false);
    expect(parseEnvBool(null as unknown as string)).toBe(false);
    expect(parseEnvBool('')).toBe(false);
  });
});

describe('vendor-strategy: determineVendoringPlan', () => {
  it('prefers local when JS_DEBUG_LOCAL_PATH is set (non-empty)', () => {
    const env: Record<string, string | undefined> = {
      JS_DEBUG_LOCAL_PATH: 'C:\\temp\\vsDebugServer.js',
      JS_DEBUG_BUILD_FROM_SOURCE: 'true'
    };
    const plan = determineVendoringPlan(env);
    expect(plan).toEqual({ mode: 'local', localPath: 'C:\\temp\\vsDebugServer.js' });
  });

  it('chooses prebuilt-then-source when JS_DEBUG_BUILD_FROM_SOURCE=true', () => {
    const env: Record<string, string | undefined> = {
      JS_DEBUG_LOCAL_PATH: '',
      JS_DEBUG_BUILD_FROM_SOURCE: 'true'
    };
    const plan = determineVendoringPlan(env);
    expect(plan).toEqual({ mode: 'prebuilt-then-source' });
  });

  it('defaults to prebuilt-only otherwise', () => {
    const env: Record<string, string | undefined> = {
      JS_DEBUG_LOCAL_PATH: '',
      JS_DEBUG_BUILD_FROM_SOURCE: 'false'
    };
    const plan = determineVendoringPlan(env);
    expect(plan).toEqual({ mode: 'prebuilt-only' });
  });

  it('treats missing env as prebuilt-only', () => {
    const env: Record<string, string | undefined> = {};
    const plan = determineVendoringPlan(env);
    expect(plan).toEqual({ mode: 'prebuilt-only' });
  });
});
