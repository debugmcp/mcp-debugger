import { describe, it, expect, vi } from 'vitest';
import { Command } from 'commander';
import {
  createCLI,
  setupStdioCommand,
  setupSSECommand,
  setupHttpCommand,
  setupDoctorCommand
} from '../../../src/cli/setup.js';

describe('CLI Setup', () => {
  describe('createCLI', () => {
    it('should create a Command instance with correct configuration', () => {
      const name = 'test-cli';
      const description = 'Test CLI description';
      const version = '1.0.0';

      const program = createCLI(name, description, version);

      expect(program).toBeInstanceOf(Command);
      expect(program.name()).toBe(name);
      expect(program.description()).toBe(description);
      expect(program.version()).toBe(version);
    });
  });

  describe('setupStdioCommand', () => {
    it('should configure stdio command with correct options', () => {
      const program = new Command();
      const mockHandler = vi.fn();
      
      setupStdioCommand(program, mockHandler);

      // Get the stdio command
      const stdioCommand = program.commands.find(cmd => cmd.name() === 'stdio');
      
      expect(stdioCommand).toBeDefined();
      expect(stdioCommand?.description()).toBe('Start the server using stdio as transport');
      expect(stdioCommand?.options).toHaveLength(2);
      
      // Check options
      const options = stdioCommand?.options || [];
      const logLevelOption = options.find(opt => opt.long === '--log-level');
      const logFileOption = options.find(opt => opt.long === '--log-file');
      
      expect(logLevelOption).toBeDefined();
      expect(logLevelOption?.short).toBe('-l');
      expect(logLevelOption?.description).toBe('Set log level (error, warn, info, debug)');
      expect(logLevelOption?.defaultValue).toBe('info');
      
      expect(logFileOption).toBeDefined();
      expect(logFileOption?.description).toBe('Log to file instead of console');
    });

    it('should call handler when stdio command is executed', async () => {
      const program = new Command();
      const mockHandler = vi.fn().mockResolvedValue(undefined);
      
      setupStdioCommand(program, mockHandler);

      // Execute the command
      await program.parseAsync(['node', 'test', 'stdio', '--log-level', 'debug']);

      expect(mockHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          logLevel: 'debug'
        }),
        expect.anything()
      );
    });

    it('should use default log level when not specified', async () => {
      const program = new Command();
      const mockHandler = vi.fn().mockResolvedValue(undefined);
      
      setupStdioCommand(program, mockHandler);

      // Execute the command without log level
      await program.parseAsync(['node', 'test', 'stdio']);

      expect(mockHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          logLevel: 'info'
        }),
        expect.anything()
      );
    });
  });

  describe('setupSSECommand', () => {
    it('should configure sse command with correct options', () => {
      const program = new Command();
      const mockHandler = vi.fn();
      
      setupSSECommand(program, mockHandler);

      // Get the sse command
      const sseCommand = program.commands.find(cmd => cmd.name() === 'sse');
      
      expect(sseCommand).toBeDefined();
      expect(sseCommand?.description()).toBe('Start the server using SSE (DEPRECATED: use "http" subcommand instead)');
      expect(sseCommand?.options).toHaveLength(5);
      
      // Check options
      const options = sseCommand?.options || [];

      // The bind address option (issue #680): no commander default, so the
      // environment variable can win; the default is spelled out in the text.
      const bindOpt = options.find(opt => opt.long === '--bind');
      expect(bindOpt).toBeDefined();
      expect(bindOpt?.flags).toBe('--bind <address>');
      expect(bindOpt?.description).toContain('127.0.0.1');
      expect(bindOpt?.description).toContain('MCP_HTTP_BIND');
      expect(bindOpt?.defaultValue).toBeUndefined();
      const portOption = options.find(opt => opt.long === '--port');
      const logLevelOption = options.find(opt => opt.long === '--log-level');
      const logFileOption = options.find(opt => opt.long === '--log-file');
      
      expect(portOption).toBeDefined();
      expect(portOption?.short).toBe('-p');
      expect(portOption?.description).toBe('Port to listen on');
      expect(portOption?.defaultValue).toBe('3001');
      
      expect(logLevelOption).toBeDefined();
      expect(logLevelOption?.short).toBe('-l');
      expect(logLevelOption?.description).toBe('Set log level (error, warn, info, debug)');
      expect(logLevelOption?.defaultValue).toBe('info');
      
      expect(logFileOption).toBeDefined();
      expect(logFileOption?.description).toBe('Log to file instead of console');

      // The same Host/Origin allowlist option the http command has (issue #671).
      const allowedHostOption = options.find(opt => opt.long === '--allowed-host');
      expect(allowedHostOption?.defaultValue).toEqual([]);
      expect(allowedHostOption?.description).toContain('MCP_HTTP_ALLOWED_HOSTS');
      expect(allowedHostOption?.defaultValueDescription).toBe('localhost, 127.0.0.1, [::1]');
      expect(sseCommand?.helpInformation()).not.toContain('(default: [])');
    });

    it('collects every --allowed-host occurrence, in order (issue #671)', async () => {
      const program = new Command();
      const mockHandler = vi.fn().mockResolvedValue(undefined);

      setupSSECommand(program, mockHandler);

      await program.parseAsync([
        'node', 'test', 'sse', '--allowed-host', 'mcp-debugger', '--allowed-host', 'api.internal',
      ]);

      expect(mockHandler).toHaveBeenCalledWith(
        expect.objectContaining({ allowedHost: ['mcp-debugger', 'api.internal'] }),
        expect.anything()
      );
    });

    it('should call handler when sse command is executed', async () => {
      const program = new Command();
      const mockHandler = vi.fn().mockResolvedValue(undefined);
      
      setupSSECommand(program, mockHandler);

      // Execute the command
      await program.parseAsync(['node', 'test', 'sse', '--port', '4000', '--log-level', 'debug']);

      expect(mockHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          port: '4000',
          logLevel: 'debug'
        }),
        expect.anything()
      );
    });

    it('should use default values when options not specified', async () => {
      const program = new Command();
      const mockHandler = vi.fn().mockResolvedValue(undefined);
      
      setupSSECommand(program, mockHandler);

      // Execute the command without options
      await program.parseAsync(['node', 'test', 'sse']);

      expect(mockHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          port: '3001',
          logLevel: 'info'
        }),
        expect.anything()
      );
    });
  });

  describe('setupHttpCommand', () => {
    it('should configure http command with correct options', () => {
      const program = new Command();
      const mockHandler = vi.fn();

      setupHttpCommand(program, mockHandler);

      const httpCommand = program.commands.find(cmd => cmd.name() === 'http');

      expect(httpCommand).toBeDefined();
      expect(httpCommand?.description()).toBe(
        'Start the server using Streamable HTTP transport (recommended)'
      );
      expect(httpCommand?.options).toHaveLength(5);

      const options = httpCommand?.options || [];

      // The bind address option (issue #680): no commander default, so the
      // environment variable can win; the default is spelled out in the text.
      const bindOpt = options.find(opt => opt.long === '--bind');
      expect(bindOpt).toBeDefined();
      expect(bindOpt?.flags).toBe('--bind <address>');
      expect(bindOpt?.description).toContain('127.0.0.1');
      expect(bindOpt?.description).toContain('MCP_HTTP_BIND');
      expect(bindOpt?.defaultValue).toBeUndefined();
      const portOption = options.find(opt => opt.long === '--port');
      const logLevelOption = options.find(opt => opt.long === '--log-level');
      const logFileOption = options.find(opt => opt.long === '--log-file');
      const allowedHostOption = options.find(opt => opt.long === '--allowed-host');

      expect(portOption?.short).toBe('-p');
      expect(portOption?.defaultValue).toBe('3001');
      expect(logLevelOption?.defaultValue).toBe('info');
      expect(logFileOption).toBeDefined();
      expect(allowedHostOption?.defaultValue).toEqual([]);
      expect(allowedHostOption?.description).toContain('MCP_HTTP_ALLOWED_HOSTS');
      // The help must show the real default once — not a hand-written sentence
      // followed by commander's own "(default: [])".
      expect(allowedHostOption?.defaultValueDescription).toBe('localhost, 127.0.0.1, [::1]');
      expect(httpCommand?.helpInformation()).not.toContain('(default: [])');
    });

    it('collects every --allowed-host occurrence, in order (issue #667)', async () => {
      const program = new Command();
      const mockHandler = vi.fn().mockResolvedValue(undefined);

      setupHttpCommand(program, mockHandler);

      await program.parseAsync([
        'node', 'test', 'http', '--allowed-host', 'mcp-debugger', '--allowed-host', 'api.internal',
      ]);

      expect(mockHandler).toHaveBeenCalledWith(
        expect.objectContaining({ allowedHost: ['mcp-debugger', 'api.internal'] }),
        expect.anything()
      );
    });

    it('should call handler when http command is executed', async () => {
      const program = new Command();
      const mockHandler = vi.fn().mockResolvedValue(undefined);

      setupHttpCommand(program, mockHandler);

      await program.parseAsync(['node', 'test', 'http', '--port', '4000', '--log-level', 'debug']);

      expect(mockHandler).toHaveBeenCalledWith(
        expect.objectContaining({ port: '4000', logLevel: 'debug' }),
        expect.anything()
      );
    });
  });

  describe('setupDoctorCommand', () => {
    it('should configure doctor command with variadic languages and options', () => {
      const program = new Command();
      const mockHandler = vi.fn();

      setupDoctorCommand(program, mockHandler);

      const doctorCommand = program.commands.find(cmd => cmd.name() === 'doctor');

      expect(doctorCommand).toBeDefined();
      expect(doctorCommand?.description()).toContain('toolchain');

      const options = doctorCommand?.options || [];
      const jsonOption = options.find(opt => opt.long === '--json');
      const timeoutOption = options.find(opt => opt.long === '--timeout');

      expect(jsonOption).toBeDefined();
      expect(jsonOption?.defaultValue).toBe(false);
      expect(timeoutOption).toBeDefined();
      expect(timeoutOption?.defaultValue).toBe('10000');
    });

    it('should pass requested languages and parsed options to the handler', async () => {
      const program = new Command();
      const mockHandler = vi.fn().mockResolvedValue(undefined);

      setupDoctorCommand(program, mockHandler);

      await program.parseAsync(['node', 'test', 'doctor', 'python', 'go', '--json']);

      expect(mockHandler).toHaveBeenCalledWith(
        ['python', 'go'],
        expect.objectContaining({ json: true, timeout: '10000' }),
        expect.anything()
      );
    });

    it('should pass an empty language list when none are requested', async () => {
      const program = new Command();
      const mockHandler = vi.fn().mockResolvedValue(undefined);

      setupDoctorCommand(program, mockHandler);

      await program.parseAsync(['node', 'test', 'doctor']);

      expect(mockHandler).toHaveBeenCalledWith(
        [],
        expect.objectContaining({ json: false, timeout: '10000' }),
        expect.anything()
      );
    });
  });

  describe('Integration', () => {
    it('should set stdio as default command', async () => {
      const program = new Command();
      const stdioHandler = vi.fn().mockResolvedValue(undefined);
      const sseHandler = vi.fn().mockResolvedValue(undefined);

      setupStdioCommand(program, stdioHandler);
      setupSSECommand(program, sseHandler);

      // Execute without specifying a command (should run default stdio)
      await program.parseAsync(['node', 'test']);

      expect(stdioHandler).toHaveBeenCalled();
      expect(sseHandler).not.toHaveBeenCalled();
    });

    it('should keep stdio as the default when doctor is registered', async () => {
      const program = new Command();
      const stdioHandler = vi.fn().mockResolvedValue(undefined);
      const doctorHandler = vi.fn().mockResolvedValue(undefined);

      setupStdioCommand(program, stdioHandler);
      setupDoctorCommand(program, doctorHandler);

      await program.parseAsync(['node', 'test']);

      expect(stdioHandler).toHaveBeenCalled();
      expect(doctorHandler).not.toHaveBeenCalled();
    });
  });
});
