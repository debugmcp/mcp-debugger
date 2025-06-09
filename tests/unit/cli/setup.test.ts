import { describe, it, expect, vi } from 'vitest';
import { Command } from 'commander';
import { createCLI, setupStdioCommand, setupSSECommand, StdioHandler, SSEHandler } from '../../../src/cli/setup.js';

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
      expect(sseCommand?.description()).toBe('Start the server using SSE (Server-Sent Events) transport');
      expect(sseCommand?.options).toHaveLength(3);
      
      // Check options
      const options = sseCommand?.options || [];
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
  });
});
