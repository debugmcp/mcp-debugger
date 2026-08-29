/**
 * Intake validation shared by the tool handlers.
 */
import { describe, it, expect } from 'vitest';
import { McpError, ErrorCode as McpErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { IEnvironment } from '@debugmcp/shared';
import type { ToolArguments } from '../../../../src/server/tool-arguments.js';
import {
  assertPlainObjectArg,
  enforceExplicitNames,
  NEVER_VALID_DAP_LAUNCH_KEYS,
  normalizeStartDebuggingArgs,
  requireSessionId,
  validateBreakOnExceptions
} from '../../../../src/server/tool-validation.js';

function environmentWith(values: Record<string, string>): IEnvironment {
  return {
    get: (key: string) => values[key],
    getAll: () => ({ ...values }),
    getCurrentWorkingDirectory: () => '/workspace'
  };
}

describe('requireSessionId', () => {
  it('accepts a session id', () => {
    const args: ToolArguments = { sessionId: 's1' };
    expect(() => requireSessionId(args)).not.toThrow();
  });

  it.each([{}, { sessionId: '' }])('rejects %j with the unified message', (raw) => {
    const args = raw as ToolArguments;
    expect(() => requireSessionId(args)).toThrow(McpError);
    expect(() => requireSessionId(args)).toThrow('Missing required parameter: sessionId');
  });
});

describe('assertPlainObjectArg', () => {
  it('accepts an omitted argument and a plain object', () => {
    expect(() => assertPlainObjectArg(undefined, 'adapterConfig')).not.toThrow();
    expect(() => assertPlainObjectArg({ pathMappings: [] }, 'adapterConfig')).not.toThrow();
  });

  it.each([null, [], 'nope', 7])('rejects %j', (value) => {
    expect(() => assertPlainObjectArg(value, 'adapterLaunchConfig'))
      .toThrow('adapterLaunchConfig must be an object when provided');
  });
});

describe('validateBreakOnExceptions', () => {
  it('passes the three valid modes through and leaves undefined alone', () => {
    expect(validateBreakOnExceptions(undefined)).toBeUndefined();
    expect(validateBreakOnExceptions('uncaught')).toBe('uncaught');
    expect(validateBreakOnExceptions('all')).toBe('all');
    expect(validateBreakOnExceptions('none')).toBe('none');
  });

  it('rejects anything else and echoes the value', () => {
    expect(() => validateBreakOnExceptions('sometimes'))
      .toThrow("breakOnExceptions must be one of 'uncaught', 'all', 'none' (got 'sometimes')");
  });
});

describe('normalizeStartDebuggingArgs', () => {
  it('leaves a non-object dapLaunchArgs untouched', () => {
    const result = normalizeStartDebuggingArgs(undefined, 'all');
    expect(result).toEqual({ dapLaunchArgs: undefined, breakOnExceptions: 'all', warnings: [] });
  });

  it('strips every never-valid nested key with one warning each', () => {
    const nested = Object.fromEntries(NEVER_VALID_DAP_LAUNCH_KEYS.map((key) => [key, 'x']));
    const result = normalizeStartDebuggingArgs(
      { stopOnEntry: true, ...nested } as Record<string, unknown>,
      undefined
    );

    expect(result.dapLaunchArgs).toEqual({ stopOnEntry: true });
    expect(result.warnings).toHaveLength(NEVER_VALID_DAP_LAUNCH_KEYS.length);
    for (const key of NEVER_VALID_DAP_LAUNCH_KEYS) {
      expect(result.warnings.some((w) => w.includes(`'${key}' is a top-level`))).toBe(true);
    }
  });

  it('honors a nested breakOnExceptions as an alias when no top-level value is given', () => {
    const result = normalizeStartDebuggingArgs(
      { breakOnExceptions: 'all' } as Record<string, unknown>,
      undefined
    );

    expect(result.breakOnExceptions).toBe('all');
    expect(result.dapLaunchArgs).toEqual({});
    expect(result.warnings[0]).toContain('honored as');
  });

  it('lets the top-level value win when both are given', () => {
    const result = normalizeStartDebuggingArgs(
      { breakOnExceptions: 'all' } as Record<string, unknown>,
      'uncaught'
    );

    expect(result.breakOnExceptions).toBe('uncaught');
    expect(result.warnings[0]).toContain('the top-level value wins');
  });
});

describe('enforceExplicitNames', () => {
  it('is a no-op in the default (open) access mode', () => {
    const environment = environmentWith({});
    expect(() => enforceExplicitNames(environment, 'get_variables', undefined)).not.toThrow();
  });

  it('requires a non-empty names filter in explicit mode', () => {
    const environment = environmentWith({ DEBUG_MCP_VARIABLE_ACCESS: 'explicit' });

    expect(() => enforceExplicitNames(environment, 'get_variables', ['user'])).not.toThrow();
    for (const names of [undefined, []]) {
      const call = () => enforceExplicitNames(environment, 'get_variables', names);
      expect(call).toThrow(McpError);
      // McpError renders its code into the message, so this pins both.
      expect(call).toThrow(`MCP error ${McpErrorCode.InvalidParams}`);
      expect(call).toThrow('get_variables requires "names"');
    }
  });
});
