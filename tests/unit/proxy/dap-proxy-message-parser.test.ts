/**
 * Unit tests for MessageParser
 */

import { describe, it, expect } from 'vitest';
import { MessageParser } from '../../../src/proxy/dap-proxy-message-parser.js';
import {
  ProxyInitPayload,
  DapCommandPayload,
  TerminatePayload
} from '../../../src/proxy/dap-proxy-interfaces.js';

describe('MessageParser', () => {
  describe('parseCommand', () => {
    it('should parse valid init command from object', () => {
      const command = {
        cmd: 'init',
        sessionId: 'test-session',
        executablePath: '/usr/bin/python3',
        adapterHost: 'localhost',
        adapterPort: 5678,
        logDir: '/tmp/logs',
        scriptPath: '/home/user/script.py'
      };

      const result = MessageParser.parseCommand(command);
      expect(result).toEqual(command);
      expect(result.cmd).toBe('init');
    });

    it('should parse valid init command from JSON string', () => {
      const command = {
        cmd: 'init',
        sessionId: 'test-session',
        executablePath: '/usr/bin/python3',
        adapterHost: 'localhost',
        adapterPort: 5678,
        logDir: '/tmp/logs',
        scriptPath: '/home/user/script.py'
      };

      const result = MessageParser.parseCommand(JSON.stringify(command));
      expect(result).toEqual(command);
    });

    it('should parse valid dap command', () => {
      const command: DapCommandPayload = {
        cmd: 'dap',
        sessionId: 'test-session',
        requestId: 'req-123',
        dapCommand: 'continue',
        dapArgs: { threadId: 1 }
      };

      const result = MessageParser.parseCommand(command);
      expect(result).toEqual(command);
      expect(result.cmd).toBe('dap');
    });

    it('should parse valid terminate command', () => {
      const command: TerminatePayload = {
        cmd: 'terminate',
        sessionId: 'test-session'
      };

      const result = MessageParser.parseCommand(command);
      expect(result).toEqual(command);
      expect(result.cmd).toBe('terminate');
    });

    it('should throw on invalid JSON string', () => {
      expect(() => MessageParser.parseCommand('{ invalid json'))
        .toThrow('Failed to parse JSON message');
    });

    it('should throw on non-object message', () => {
      expect(() => MessageParser.parseCommand(123))
        .toThrow('Invalid message type: expected object, got number');
      
      expect(() => MessageParser.parseCommand(null))
        .toThrow('Invalid message type: expected object, got object'); // null is object
    });

    it('should throw on missing cmd field', () => {
      expect(() => MessageParser.parseCommand({ sessionId: 'test' }))
        .toThrow("Missing or invalid 'cmd' field");
    });

    it('should throw on missing sessionId field', () => {
      expect(() => MessageParser.parseCommand({ cmd: 'init' }))
        .toThrow("Missing or invalid 'sessionId' field");
    });

    it('should throw on unknown command type', () => {
      expect(() => MessageParser.parseCommand({ cmd: 'unknown', sessionId: 'test' }))
        .toThrow('Unknown command type: unknown');
    });
  });

  describe('validateInitPayload', () => {
    it('should validate complete init payload', () => {
      const payload = {
        cmd: 'init',
        sessionId: 'test-session',
        executablePath: '/usr/bin/python3',
        adapterHost: 'localhost',
        adapterPort: 5678,
        logDir: '/tmp/logs',
        scriptPath: '/home/user/script.py',
        scriptArgs: ['arg1', 'arg2'],
        stopOnEntry: true,
        justMyCode: false,
        dryRunSpawn: true,
        initialBreakpoints: [
          { file: 'test.py', line: 10 },
          { file: 'test.py', line: 20, condition: 'x > 5' }
        ]
      };

      const result = MessageParser.validateInitPayload(payload);
      expect(result).toEqual(payload);
    });

    it('should validate minimal init payload', () => {
      const payload = {
        cmd: 'init',
        sessionId: 'test-session',
        executablePath: '/usr/bin/python3',
        adapterHost: 'localhost',
        adapterPort: 5678,
        logDir: '/tmp/logs',
        scriptPath: '/home/user/script.py'
      };

      const result = MessageParser.validateInitPayload(payload);
      expect(result).toEqual(payload);
    });

    it('should throw on missing required fields', () => {
      const requiredFields = [
        'sessionId', 'executablePath', 'adapterHost', 'logDir', 'scriptPath'
      ];

      requiredFields.forEach(field => {
        const payload: any = {
          cmd: 'init',
          sessionId: 'test-session',
          executablePath: '/usr/bin/python3',
          adapterHost: 'localhost',
          adapterPort: 5678,
          logDir: '/tmp/logs',
          scriptPath: '/home/user/script.py'
        };
        delete payload[field];

        expect(() => MessageParser.validateInitPayload(payload))
          .toThrow(`Init payload missing or invalid '${field}'`);
      });
    });

    it('should throw on invalid adapterPort', () => {
      const invalidPorts = [0, -1, 65536, 'not-a-number', null, undefined];

      invalidPorts.forEach(port => {
        const payload = {
          cmd: 'init',
          sessionId: 'test-session',
          executablePath: '/usr/bin/python3',
          adapterHost: 'localhost',
          adapterPort: port as any,
          logDir: '/tmp/logs',
          scriptPath: '/home/user/script.py'
        };

        expect(() => MessageParser.validateInitPayload(payload))
          .toThrow("Init payload invalid 'adapterPort'");
      });
    });

    it('should throw on invalid optional fields', () => {
      const invalidOptionals = [
        { scriptArgs: 'not-an-array', error: 'scriptArgs' },
        { stopOnEntry: 'not-a-boolean', error: 'stopOnEntry' },
        { justMyCode: 123, error: 'justMyCode' },
        { dryRunSpawn: [], error: 'dryRunSpawn' },
        { initialBreakpoints: 'not-an-array', error: 'initialBreakpoints' }
      ];

      invalidOptionals.forEach(({ error, ...invalidField }) => {
        const payload = {
          cmd: 'init',
          sessionId: 'test-session',
          executablePath: '/usr/bin/python3',
          adapterHost: 'localhost',
          adapterPort: 5678,
          logDir: '/tmp/logs',
          scriptPath: '/home/user/script.py',
          ...invalidField
        };

        expect(() => MessageParser.validateInitPayload(payload))
          .toThrow(`Init payload '${error}' must be`);
      });
    });

    it('should throw on invalid breakpoints', () => {
      const invalidBreakpoints = [
        [{}], // Missing file and line
        [{ file: 'test.py' }], // Missing line
        [{ line: 10 }], // Missing file
        [{ file: 123, line: 10 }], // Invalid file type
        [{ file: 'test.py', line: '10' }], // Invalid line type
        [{ file: 'test.py', line: 10, condition: 123 }] // Invalid condition type
      ];

      invalidBreakpoints.forEach(breakpoints => {
        const payload = {
          cmd: 'init',
          sessionId: 'test-session',
          executablePath: '/usr/bin/python3',
          adapterHost: 'localhost',
          adapterPort: 5678,
          logDir: '/tmp/logs',
          scriptPath: '/home/user/script.py',
          initialBreakpoints: breakpoints
        };

        expect(() => MessageParser.validateInitPayload(payload))
          .toThrow(/Breakpoint/);
      });
    });
  });

  describe('validateDapPayload', () => {
    it('should validate complete dap payload', () => {
      const payload = {
        cmd: 'dap',
        sessionId: 'test-session',
        requestId: 'req-123',
        dapCommand: 'continue',
        dapArgs: { threadId: 1 }
      };

      const result = MessageParser.validateDapPayload(payload);
      expect(result).toEqual(payload);
    });

    it('should validate minimal dap payload', () => {
      const payload = {
        cmd: 'dap',
        sessionId: 'test-session',
        requestId: 'req-123',
        dapCommand: 'continue'
      };

      const result = MessageParser.validateDapPayload(payload);
      expect(result).toEqual(payload);
    });

    it('should throw on missing required fields', () => {
      const requiredFields = ['sessionId', 'requestId', 'dapCommand'];

      requiredFields.forEach(field => {
        const payload: any = {
          cmd: 'dap',
          sessionId: 'test-session',
          requestId: 'req-123',
          dapCommand: 'continue'
        };
        delete payload[field];

        expect(() => MessageParser.validateDapPayload(payload))
          .toThrow(`DAP payload missing or invalid '${field}'`);
      });
    });

    it('should throw on null dapArgs', () => {
      const payload = {
        cmd: 'dap',
        sessionId: 'test-session',
        requestId: 'req-123',
        dapCommand: 'continue',
        dapArgs: null
      };

      expect(() => MessageParser.validateDapPayload(payload))
        .toThrow("DAP payload 'dapArgs' should not be null");
    });
  });

  describe('validateTerminatePayload', () => {
    it('should validate terminate payload', () => {
      const payload = {
        cmd: 'terminate',
        sessionId: 'test-session'
      };

      const result = MessageParser.validateTerminatePayload(payload);
      expect(result).toEqual(payload);
    });

    it('should throw on missing sessionId', () => {
      const payload = {
        cmd: 'terminate'
      };

      expect(() => MessageParser.validateTerminatePayload(payload))
        .toThrow("Terminate payload missing or invalid 'sessionId'");
    });
  });

  describe('helper functions', () => {
    it('isStringMessage should identify strings', () => {
      expect(MessageParser.isStringMessage('test')).toBe(true);
      expect(MessageParser.isStringMessage(123)).toBe(false);
      expect(MessageParser.isStringMessage({})).toBe(false);
      expect(MessageParser.isStringMessage(null)).toBe(false);
    });

    it('getErrorMessage should extract error messages', () => {
      expect(MessageParser.getErrorMessage(new Error('Test error'))).toBe('Test error');
      expect(MessageParser.getErrorMessage('String error')).toBe('String error');
      expect(MessageParser.getErrorMessage(123)).toBe('123');
      expect(MessageParser.getErrorMessage({ message: 'Object' })).toBe('[object Object]');
      expect(MessageParser.getErrorMessage(null)).toBe('null');
      expect(MessageParser.getErrorMessage(undefined)).toBe('undefined');
    });
  });
});
