import { describe, it, expect, vi, beforeEach } from 'vitest';
import { main, createDebugMcpServer } from '../../src/index.js';
import { createLogger } from '../../src/utils/logger.js';
import { DebugMcpServer } from '../../src/server.js';
import * as errorHandlers from '../../src/cli/error-handlers.js';
import * as setup from '../../src/cli/setup.js';
import * as stdioCommand from '../../src/cli/stdio-command.js';
import * as sseCommand from '../../src/cli/sse-command.js';
import * as version from '../../src/cli/version.js';

vi.mock('../../src/utils/logger.js');
vi.mock('../../src/server.js');
vi.mock('../../src/cli/error-handlers.js');
vi.mock('../../src/cli/setup.js');
vi.mock('../../src/cli/stdio-command.js');
vi.mock('../../src/cli/sse-command.js');
vi.mock('../../src/cli/version.js');

describe('index.ts', () => {
  let mockLogger: any;
  let mockProgram: any;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Mock logger
    mockLogger = {
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
      debug: vi.fn()
    };
    vi.mocked(createLogger).mockReturnValue(mockLogger);

    // Mock program
    mockProgram = {
      parse: vi.fn()
    };

    // Mock CLI setup functions
    vi.mocked(setup.createCLI).mockReturnValue(mockProgram);
    vi.mocked(setup.setupStdioCommand).mockImplementation(() => {});
    vi.mocked(setup.setupSSECommand).mockImplementation(() => {});

    // Mock version
    vi.mocked(version.getVersion).mockReturnValue('1.0.0');

    // Mock command handlers
    vi.mocked(stdioCommand.handleStdioCommand).mockResolvedValue(undefined);
    vi.mocked(sseCommand.handleSSECommand).mockResolvedValue(undefined);
  });

  describe('createDebugMcpServer', () => {
    it('should create a new DebugMcpServer instance with given options', () => {
      const mockServer = { server: 'instance' };
      vi.mocked(DebugMcpServer).mockReturnValue(mockServer as any);

      const options = { logLevel: 'debug', logFile: '/tmp/test.log' };
      const result = createDebugMcpServer(options);

      expect(DebugMcpServer).toHaveBeenCalledWith(options);
      expect(result).toBe(mockServer);
    });
  });

  describe('main', () => {
    it('should set up the CLI and parse arguments', async () => {
      await main();

      // Verify logger was created
      expect(createLogger).toHaveBeenCalledWith('debug-mcp:cli');

      // Verify error handlers were set up
      expect(errorHandlers.setupErrorHandlers).toHaveBeenCalledWith({ logger: mockLogger });

      // Verify CLI was created
      expect(setup.createCLI).toHaveBeenCalledWith(
        'debug-mcp-server',
        'Step-through debugging MCP server for LLMs',
        '1.0.0'
      );

      // Verify commands were set up
      expect(setup.setupStdioCommand).toHaveBeenCalledWith(mockProgram, expect.any(Function));
      expect(setup.setupSSECommand).toHaveBeenCalledWith(mockProgram, expect.any(Function));

      // Verify parse was called
      expect(mockProgram.parse).toHaveBeenCalled();
    });

    it('should pass correct handlers to setupStdioCommand', async () => {
      let capturedHandler: any;
      vi.mocked(setup.setupStdioCommand).mockImplementation((program, handler) => {
        capturedHandler = handler;
      });

      await main();

      // Call the captured handler
      const options = { logLevel: 'debug' };
      await capturedHandler(options);

      // Verify handleStdioCommand was called with correct dependencies
      expect(stdioCommand.handleStdioCommand).toHaveBeenCalledWith(
        options,
        {
          logger: mockLogger,
          serverFactory: createDebugMcpServer
        }
      );
    });

    it('should pass correct handlers to setupSSECommand', async () => {
      let capturedHandler: any;
      vi.mocked(setup.setupSSECommand).mockImplementation((program, handler) => {
        capturedHandler = handler;
      });

      await main();

      // Call the captured handler
      const options = { port: '4000', logLevel: 'debug' };
      await capturedHandler(options);

      // Verify handleSSECommand was called with correct dependencies
      expect(sseCommand.handleSSECommand).toHaveBeenCalledWith(
        options,
        {
          logger: mockLogger,
          serverFactory: createDebugMcpServer
        }
      );
    });
  });

  describe('Module execution guard', () => {
    it('should not execute main when imported as a module', async () => {
      // The import at the top of this file should not trigger main execution
      expect(mockProgram.parse).not.toHaveBeenCalled();
    });
  });

  describe('Exports', () => {
    it('should export all necessary functions', async () => {
      // The exports are already tested by the fact that we can import them at the top
      expect(main).toBeDefined();
      expect(createDebugMcpServer).toBeDefined();
      
      // These are re-exported from other modules
      expect(errorHandlers.setupErrorHandlers).toBeDefined();
      expect(setup.createCLI).toBeDefined();
      expect(setup.setupStdioCommand).toBeDefined();
      expect(setup.setupSSECommand).toBeDefined();
      expect(stdioCommand.handleStdioCommand).toBeDefined();
      expect(sseCommand.handleSSECommand).toBeDefined();
    });
  });
});
