/**
 * Unit tests for type guards and validation utilities
 * Tests runtime type safety at critical boundaries (IPC, serialization, etc.)
 */
import { describe, it, expect, beforeEach, vi, MockInstance } from 'vitest';
import {
  isValidAdapterCommand,
  validateAdapterCommand,
  hasValidAdapterCommand,
  validateProxyInitPayload,
  serializeAdapterCommand,
  deserializeAdapterCommand,
  createAdapterCommand,
  getAdapterCommandProperty,
  logAdapterCommandValidation
} from '../../../../src/utils/type-guards.js';
import { AdapterCommand } from '@debugmcp/shared';
import { ProxyInitPayload } from '../../../../src/proxy/dap-proxy-interfaces.js';

describe('Type Guards', () => {
  let consoleErrorSpy: MockInstance;
  let consoleLogSpy: MockInstance;
  let consoleWarnSpy: MockInstance;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('isValidAdapterCommand', () => {
    it('should return true for valid adapter command', () => {
      const validCommand: AdapterCommand = {
        command: 'python',
        args: ['-m', 'debugpy'],
        env: { PATH: '/usr/bin' }
      };
      
      expect(isValidAdapterCommand(validCommand)).toBe(true);
    });

    it('should return true for valid command without env', () => {
      const validCommand = {
        command: 'node',
        args: ['--inspect']
      };
      
      expect(isValidAdapterCommand(validCommand)).toBe(true);
    });

    it('should return true for valid command with empty args', () => {
      const validCommand = {
        command: 'python',
        args: []
      };
      
      expect(isValidAdapterCommand(validCommand)).toBe(true);
    });

    it('should verify TypeScript type narrowing', () => {
      const unknownValue: unknown = { command: 'test', args: ['arg1'] };
      
      if (isValidAdapterCommand(unknownValue)) {
        // TypeScript should now know this is AdapterCommand
        expect(unknownValue.command).toBe('test');
        expect(unknownValue.args).toEqual(['arg1']);
        // This should compile without errors
        const cmd: AdapterCommand = unknownValue;
        expect(cmd).toBeDefined();
      }
    });

    it('should return false for null', () => {
      expect(isValidAdapterCommand(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isValidAdapterCommand(undefined)).toBe(false);
    });

    it('should return false for non-objects', () => {
      expect(isValidAdapterCommand('string')).toBe(false);
      expect(isValidAdapterCommand(123)).toBe(false);
      expect(isValidAdapterCommand(true)).toBe(false);
      expect(isValidAdapterCommand([])).toBe(false);
      expect(isValidAdapterCommand(Symbol('test'))).toBe(false);
    });

    it('should return false for objects with missing command', () => {
      expect(isValidAdapterCommand({ args: [] })).toBe(false);
    });

    it('should return false for objects with invalid command type', () => {
      expect(isValidAdapterCommand({ command: 123, args: [] })).toBe(false);
      expect(isValidAdapterCommand({ command: null, args: [] })).toBe(false);
      expect(isValidAdapterCommand({ command: '', args: [] })).toBe(false);
    });

    it('should return false for objects with missing args', () => {
      expect(isValidAdapterCommand({ command: 'python' })).toBe(false);
    });

    it('should return false for objects with non-array args', () => {
      expect(isValidAdapterCommand({ command: 'python', args: 'invalid' })).toBe(false);
      expect(isValidAdapterCommand({ command: 'python', args: {} })).toBe(false);
      expect(isValidAdapterCommand({ command: 'python', args: null })).toBe(false);
    });

    it('should return false if args contains non-string elements', () => {
      expect(isValidAdapterCommand({ command: 'python', args: [123] })).toBe(false);
      expect(isValidAdapterCommand({ command: 'python', args: ['valid', null] })).toBe(false);
      expect(isValidAdapterCommand({ command: 'python', args: ['valid', undefined] })).toBe(false);
      expect(isValidAdapterCommand({ command: 'python', args: ['valid', {}] })).toBe(false);
    });

    it('should return false for invalid env field', () => {
      expect(isValidAdapterCommand({ command: 'python', args: [], env: 'invalid' })).toBe(false);
      expect(isValidAdapterCommand({ command: 'python', args: [], env: null })).toBe(false);
      expect(isValidAdapterCommand({ command: 'python', args: [], env: [] })).toBe(false);
    });

    it('should return false if env contains non-string values', () => {
      expect(isValidAdapterCommand({ 
        command: 'python', 
        args: [], 
        env: { PATH: 123 } 
      })).toBe(false);
      
      expect(isValidAdapterCommand({ 
        command: 'python', 
        args: [], 
        env: { PATH: '/usr/bin', INVALID: null } 
      })).toBe(false);
    });

    it('should handle objects with symbol properties', () => {
      const obj = { 
        command: 'python', 
        args: [],
        [Symbol('test')]: 'value'
      };
      
      expect(isValidAdapterCommand(obj)).toBe(true);
    });

    it('should handle objects with modified prototypes', () => {
      const obj = Object.create({ injected: 'value' });
      obj.command = 'python';
      obj.args = [];
      
      expect(isValidAdapterCommand(obj)).toBe(true);
    });

    it('should handle very deeply nested objects in env', () => {
      const deepEnv: any = {};
      let current = deepEnv;
      
      // Create a deeply nested structure
      for (let i = 0; i < 100; i++) {
        current.nested = { value: 'test' };
        current = current.nested;
      }
      
      const obj = {
        command: 'python',
        args: [],
        env: deepEnv
      };
      
      // Should handle deep nesting without stack overflow
      expect(isValidAdapterCommand(obj)).toBe(false); // Invalid because nested values aren't strings
    });

    it('should handle large arrays in args efficiently', () => {
      const largeArgs = Array(1000).fill('arg');
      const obj = {
        command: 'python',
        args: largeArgs
      };
      
      const start = performance.now();
      const result = isValidAdapterCommand(obj);
      const duration = performance.now() - start;
      
      expect(result).toBe(true);
      expect(duration).toBeLessThan(10); // Should complete in under 10ms
    });
  });

  describe('validateAdapterCommand', () => {
    it('should return valid adapter command unchanged', () => {
      const validCommand: AdapterCommand = {
        command: 'python',
        args: ['-m', 'debugpy']
      };
      
      const result = validateAdapterCommand(validCommand, 'test-source');
      expect(result).toBe(validCommand);
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should throw detailed error for invalid command', () => {
      const invalidCommand = { args: [] };
      
      expect(() => {
        validateAdapterCommand(invalidCommand, 'test-source');
      }).toThrow('Invalid adapter command from test-source');
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[TYPE VALIDATION ERROR]',
        expect.stringContaining('Invalid adapter command from test-source')
      );
    });

    it('should include source in error message', () => {
      expect(() => {
        validateAdapterCommand(null, 'ipc-handler');
      }).toThrow('Invalid adapter command from ipc-handler');
    });

    it('should handle empty source strings', () => {
      expect(() => {
        validateAdapterCommand(null, '');
      }).toThrow('Invalid adapter command from ');
    });

    it('should handle very long source strings', () => {
      const longSource = 'a'.repeat(1000);
      expect(() => {
        validateAdapterCommand(null, longSource);
      }).toThrow(`Invalid adapter command from ${longSource}`);
    });

    it('should handle special characters in source', () => {
      const specialSource = 'test\n\r\t"\'\\source';
      expect(() => {
        validateAdapterCommand(null, specialSource);
      }).toThrow(`Invalid adapter command from ${specialSource}`);
    });

    it('should include detailed structure in error', () => {
      try {
        validateAdapterCommand({ command: 123 }, 'test');
      } catch (error: any) {
        expect(error.message).toContain('receivedType');
        expect(error.message).toContain('receivedValue');
        expect(error.message).toContain('requiredStructure');
      }
    });
  });

  describe('hasValidAdapterCommand', () => {
    it('should return true for payload without adapterCommand', () => {
      const payload: ProxyInitPayload = {
        cmd: 'init',
        sessionId: 'test-session',
        executablePath: '/usr/bin/python',
        adapterHost: 'localhost',
        adapterPort: 5678,
        logDir: '/logs',
        scriptPath: 'test.py'
      };
      
      expect(hasValidAdapterCommand(payload)).toBe(true);
    });

    it('should return true for payload with valid adapterCommand', () => {
      const payload: ProxyInitPayload = {
        cmd: 'init',
        sessionId: 'test-session',
        executablePath: '/usr/bin/python',
        adapterHost: 'localhost',
        adapterPort: 5678,
        logDir: '/logs',
        scriptPath: 'test.py',
        adapterCommand: {
          command: 'python',
          args: ['-m', 'debugpy']
        }
      };
      
      expect(hasValidAdapterCommand(payload)).toBe(true);
    });

    it('should return false for payload with invalid adapterCommand', () => {
      const payload: ProxyInitPayload = {
        cmd: 'init',
        sessionId: 'test-session',
        executablePath: '/usr/bin/python',
        adapterHost: 'localhost',
        adapterPort: 5678,
        logDir: '/logs',
        scriptPath: 'test.py',
        adapterCommand: { command: '', args: [] } as any
      };
      
      expect(hasValidAdapterCommand(payload)).toBe(false);
    });
  });

  describe('validateProxyInitPayload', () => {
    const validPayload: ProxyInitPayload = {
      cmd: 'init',
      sessionId: 'test-session',
      executablePath: '/usr/bin/python',
      adapterHost: 'localhost',
      adapterPort: 5678,
      logDir: '/logs',
      scriptPath: 'test.py'
    };

    it('should return valid payload unchanged', () => {
      const result = validateProxyInitPayload(validPayload);
      expect(result).toBe(validPayload);
    });

    it('should throw for non-object inputs', () => {
      expect(() => validateProxyInitPayload(null))
        .toThrow('Invalid ProxyInitPayload: must be an object');
      expect(() => validateProxyInitPayload(undefined))
        .toThrow('Invalid ProxyInitPayload: must be an object');
      expect(() => validateProxyInitPayload('string'))
        .toThrow('Invalid ProxyInitPayload: must be an object');
      expect(() => validateProxyInitPayload(123))
        .toThrow('Invalid ProxyInitPayload: must be an object');
    });

    it('should throw for missing required fields', () => {
      const requiredFields = [
        'cmd', 'sessionId', 'executablePath', 'adapterHost', 
        'adapterPort', 'logDir', 'scriptPath'
      ];
      
      requiredFields.forEach(field => {
        const incomplete = { ...validPayload, [field]: undefined };
        expect(() => validateProxyInitPayload(incomplete))
          .toThrow(`Invalid ProxyInitPayload: missing required field '${field}'`);
      });
    });

    it('should validate payload with valid adapterCommand', () => {
      const payloadWithAdapter = {
        ...validPayload,
        adapterCommand: {
          command: 'python',
          args: ['-m', 'debugpy']
        }
      };
      
      const result = validateProxyInitPayload(payloadWithAdapter);
      expect(result).toEqual(payloadWithAdapter);
    });

    it('should throw and log for invalid adapterCommand', () => {
      const payloadWithInvalidAdapter = {
        ...validPayload,
        adapterCommand: { invalid: true }
      };
      
      expect(() => validateProxyInitPayload(payloadWithInvalidAdapter))
        .toThrow('Invalid ProxyInitPayload: adapterCommand validation failed');
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[VALIDATION ERROR]',
        expect.stringContaining('adapterCommand validation failed')
      );
    });
  });

  describe('serializeAdapterCommand', () => {
    it('should serialize valid adapter command to JSON', () => {
      const cmd: AdapterCommand = {
        command: 'python',
        args: ['-m', 'debugpy'],
        env: { PATH: '/usr/bin' }
      };
      
      const result = serializeAdapterCommand(cmd);
      const parsed = JSON.parse(result);
      
      expect(parsed).toEqual(cmd);
    });

    it('should validate before serialization', () => {
      const invalid = { command: '', args: [] };
      
      expect(() => serializeAdapterCommand(invalid as any))
        .toThrow('Invalid adapter command from serialization');
    });

    it('should preserve all fields in serialization', () => {
      const cmd: AdapterCommand = {
        command: 'node',
        args: ['--inspect', '--experimental-modules'],
        env: {
          NODE_ENV: 'development',
          DEBUG: 'true',
          PATH: '/usr/local/bin:/usr/bin'
        }
      };
      
      const result = serializeAdapterCommand(cmd);
      const parsed = JSON.parse(result);
      
      expect(parsed.command).toBe(cmd.command);
      expect(parsed.args).toEqual(cmd.args);
      expect(parsed.env).toEqual(cmd.env);
    });

    it('should handle circular references gracefully', () => {
      const cmd: any = {
        command: 'python',
        args: []
      };
      cmd.circular = cmd; // Create circular reference
      
      expect(() => serializeAdapterCommand(cmd))
        .toThrow(); // JSON.stringify will throw TypeError
    });

    it('should handle BigInt values that are not JSON serializable', () => {
      const cmd: any = {
        command: 'python',
        args: [],
        env: { BIG: BigInt(123) }
      };
      
      // JSON.stringify will throw for BigInt before validation can catch it
      expect(() => serializeAdapterCommand(cmd))
        .toThrow('Do not know how to serialize a BigInt');
    });
  });

  describe('deserializeAdapterCommand', () => {
    it('should deserialize valid JSON to adapter command', () => {
      const original: AdapterCommand = {
        command: 'python',
        args: ['-m', 'debugpy']
      };
      const json = JSON.stringify(original);
      
      const result = deserializeAdapterCommand(json, 'test-source');
      expect(result).toEqual(original);
    });

    it('should throw for invalid JSON', () => {
      expect(() => deserializeAdapterCommand('invalid json', 'parser'))
        .toThrow('Failed to parse adapter command from parser');
    });

    it('should validate after parsing', () => {
      const invalidCmd = JSON.stringify({ command: '', args: [] });
      
      expect(() => deserializeAdapterCommand(invalidCmd, 'validator'))
        .toThrow('Invalid adapter command from deserialization-validator');
    });

    it('should include source in error messages', () => {
      expect(() => deserializeAdapterCommand('{invalid}', 'ipc-receiver'))
        .toThrow('Failed to parse adapter command from ipc-receiver');
    });

    it('should handle valid JSON with invalid adapter structure', () => {
      const json = JSON.stringify({ foo: 'bar' });
      
      expect(() => deserializeAdapterCommand(json, 'test'))
        .toThrow('Invalid adapter command from deserialization-test');
    });

    it('should round-trip serialize and deserialize correctly', () => {
      const original: AdapterCommand = {
        command: 'node',
        args: ['--inspect-brk', 'app.js'],
        env: { NODE_ENV: 'debug' }
      };
      
      const serialized = serializeAdapterCommand(original);
      const deserialized = deserializeAdapterCommand(serialized, 'round-trip');
      
      expect(deserialized).toEqual(original);
    });
  });

  describe('createAdapterCommand', () => {
    it('should create valid adapter command with minimal args', () => {
      const result = createAdapterCommand('python');
      
      expect(result).toEqual({
        command: 'python',
        args: [],
        env: {}
      });
    });

    it('should create adapter command with args', () => {
      const result = createAdapterCommand('python', ['-m', 'debugpy']);
      
      expect(result).toEqual({
        command: 'python',
        args: ['-m', 'debugpy'],
        env: {}
      });
    });

    it('should create adapter command with env', () => {
      const result = createAdapterCommand('node', ['app.js'], { NODE_ENV: 'test' });
      
      expect(result).toEqual({
        command: 'node',
        args: ['app.js'],
        env: { NODE_ENV: 'test' }
      });
    });

    it('should throw for invalid command', () => {
      expect(() => createAdapterCommand(''))
        .toThrow('Invalid command for adapter: ""');
      expect(() => createAdapterCommand(null as any))
        .toThrow('Invalid command for adapter: "null"');
      expect(() => createAdapterCommand(123 as any))
        .toThrow('Invalid command for adapter: "123"');
    });

    it('should handle undefined args parameter', () => {
      const result = createAdapterCommand('python', undefined);
      expect(result.args).toEqual([]);
    });

    it('should validate the created command', () => {
      // This should not throw
      const result = createAdapterCommand('python', ['test.py']);
      expect(result).toBeDefined();
      
      // Verify it's a valid AdapterCommand
      expect(isValidAdapterCommand(result)).toBe(true);
    });
  });

  describe('getAdapterCommandProperty', () => {
    const validCmd: AdapterCommand = {
      command: 'python',
      args: ['-m', 'debugpy'],
      env: { PATH: '/usr/bin' }
    };

    it('should return property value for valid command', () => {
      expect(getAdapterCommandProperty(validCmd, 'command', 'default')).toBe('python');
      expect(getAdapterCommandProperty(validCmd, 'args', [])).toEqual(['-m', 'debugpy']);
      expect(getAdapterCommandProperty(validCmd, 'env', {})).toEqual({ PATH: '/usr/bin' });
    });

    it('should return default for invalid command', () => {
      const invalid = { foo: 'bar' };
      
      expect(getAdapterCommandProperty(invalid, 'command', 'default')).toBe('default');
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[TYPE GUARD] Invalid adapter command, returning default for command'
      );
    });

    it('should return default for undefined property', () => {
      const cmdWithoutEnv: AdapterCommand = {
        command: 'python',
        args: []
      };
      
      expect(getAdapterCommandProperty(cmdWithoutEnv, 'env', { DEFAULT: 'true' }))
        .toEqual({ DEFAULT: 'true' });
    });

    it('should handle null and undefined inputs', () => {
      expect(getAdapterCommandProperty(null, 'command', 'default')).toBe('default');
      expect(getAdapterCommandProperty(undefined, 'args', [])).toEqual([]);
      
      expect(consoleWarnSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('logAdapterCommandValidation', () => {
    beforeEach(() => {
      // Mock Date to have consistent timestamps
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-01T12:00:00.000Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should log valid commands with console.log', () => {
      const cmd: AdapterCommand = {
        command: 'python',
        args: ['-m', 'debugpy']
      };
      
      logAdapterCommandValidation(cmd, 'test-source', true);
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[ADAPTER COMMAND VALIDATION]',
        expect.stringContaining('"source": "test-source"')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[ADAPTER COMMAND VALIDATION]',
        expect.stringContaining('"isValid": true')
      );
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should log invalid commands with console.error', () => {
      const invalid = { foo: 'bar' };
      
      logAdapterCommandValidation(invalid, 'error-source', false, 'Missing required fields');
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[ADAPTER COMMAND VALIDATION ERROR]',
        expect.stringContaining('"source": "error-source"')
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[ADAPTER COMMAND VALIDATION ERROR]',
        expect.stringContaining('"isValid": false')
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[ADAPTER COMMAND VALIDATION ERROR]',
        expect.stringContaining('"details": "Missing required fields"')
      );
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('should include timestamp in logs', () => {
      logAdapterCommandValidation({}, 'test', true);
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[ADAPTER COMMAND VALIDATION]',
        expect.stringContaining('"timestamp": "2024-01-01T12:00:00.000Z"')
      );
    });

    it('should format output as indented JSON', () => {
      const cmd = { command: 'test', args: [] };
      
      logAdapterCommandValidation(cmd, 'format-test', true);
      
      const logCall = consoleLogSpy.mock.calls[0][1];
      // Should be pretty-printed with 2-space indentation
      expect(logCall).toContain('{\n  "source"');
      expect(logCall).toContain('\n  ');
    });

    it('should handle complex details objects', () => {
      const complexDetails = {
        errors: ['error1', 'error2'],
        metadata: { version: '1.0', timestamp: Date.now() },
        nested: { deeply: { nested: 'value' } }
      };
      
      logAdapterCommandValidation({}, 'complex', false, complexDetails);
      
      // The function logs the entire structured object, not just the details
      const expectedLogStructure = {
        source: 'complex',
        isValid: false,
        command: {},
        timestamp: '2024-01-01T12:00:00.000Z',
        details: complexDetails
      };
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[ADAPTER COMMAND VALIDATION ERROR]',
        JSON.stringify(expectedLogStructure, null, 2)
      );
    });
  });
});
