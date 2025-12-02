#!/usr/bin/env node
/**
 * JDB DAP Server
 *
 * A Node.js process that implements the Debug Adapter Protocol (DAP)
 * and translates between DAP and jdb commands.
 *
 * This server:
 * 1. Listens on a TCP port for DAP client connections
 * 2. Parses incoming DAP requests (Content-Length + JSON-RPC)
 * 3. Translates DAP requests to jdb commands via JdbWrapper
 * 4. Translates jdb events to DAP events
 * 5. Sends DAP responses and events back to the client
 *
 * @since 1.0.0
 */
import * as net from 'net';
import * as fs from 'fs';
import * as path from 'path';
import { DebugProtocol } from '@vscode/debugprotocol';
import { JdbWrapper, JdbConfig, JdbBreakpoint } from './utils/jdb-wrapper.js';
import { JdbStoppedEvent, JdbStackFrame } from './utils/jdb-parser.js';

/**
 * Configuration for the DAP server
 */
interface ServerConfig {
  port: number;
  jdbPath: string;
  sessionId: string;
}

/**
 * Launch/Attach arguments that can be provided by the client
 */
interface LaunchAttachArgs {
  program?: string;
  cwd?: string;
  mainClass?: string;
  classpath?: string;
  vmArgs?: string[];
  args?: string[];
  sourcePath?: string;
  hostName?: string;
  host?: string;
  port?: number;
  timeout?: number;
  stopOnEntry?: boolean;
  [key: string]: unknown;
}

/**
 * Parse command-line arguments
 */
function parseArgs(): ServerConfig {
  const args = process.argv.slice(2);
  const config: Partial<ServerConfig> = {};

  for (let i = 0; i < args.length; i += 2) {
    const key = args[i];
    const value = args[i + 1];

    switch (key) {
      case '--port':
        config.port = parseInt(value, 10);
        break;
      case '--jdb-path':
        config.jdbPath = value;
        break;
      case '--session-id':
        config.sessionId = value;
        break;
    }
  }

  if (!config.port || !config.jdbPath || !config.sessionId) {
    console.error('Usage: jdb-dap-server --port PORT --jdb-path PATH --session-id ID');
    process.exit(1);
  }

  return config as ServerConfig;
}

/**
 * JDB DAP Server implementation
 */
class JdbDapServer {
  private server: net.Server;
  private connection: net.Socket | null = null;
  private jdb: JdbWrapper | null = null;
  private messageBuffer = '';
  private sequenceNumber = 1;
  private breakpoints = new Map<string, JdbBreakpoint[]>();
  private initialized = false;
  private isAttachMode = false;
  private launchArgs: LaunchAttachArgs | null = null;
  private isStoppingAtEntry = false;

  constructor(private config: ServerConfig) {
    this.server = net.createServer(this.handleConnection.bind(this));
  }

  /**
   * Start the DAP server
   */
  start(): void {
    this.server.listen(this.config.port, () => {
      console.error(`[jdb-dap-server] Listening on port ${this.config.port}`);
    });

    this.server.on('error', (error) => {
      console.error('[jdb-dap-server] Server error:', error);
      process.exit(1);
    });
  }

  /**
   * Handle incoming TCP connection from DAP client
   */
  private handleConnection(socket: net.Socket): void {
    console.error('[jdb-dap-server] Client connected');
    this.connection = socket;

    socket.on('data', (data) => {
      this.onData(data);
    });

    socket.on('end', () => {
      console.error('[jdb-dap-server] Client disconnected');
      this.cleanup();
    });

    socket.on('error', (error) => {
      console.error('[jdb-dap-server] Socket error:', error);
      this.cleanup();
    });
  }

  /**
   * Handle incoming data from DAP client
   */
  private onData(data: Buffer): void {
    this.messageBuffer += data.toString();

    // Parse DAP messages (Content-Length: N\r\n\r\n{JSON})
    while (true) {
      const headerMatch = this.messageBuffer.match(/Content-Length: (\d+)\r\n\r\n/);
      if (!headerMatch) {
        break;
      }

      const contentLength = parseInt(headerMatch[1], 10);
      const messageStart = headerMatch[0].length;
      const messageEnd = messageStart + contentLength;

      if (this.messageBuffer.length < messageEnd) {
        // Incomplete message, wait for more data
        break;
      }

      const messageJson = this.messageBuffer.substring(messageStart, messageEnd);
      this.messageBuffer = this.messageBuffer.substring(messageEnd);

      try {
        const message = JSON.parse(messageJson);
        this.handleMessage(message);
      } catch (error) {
        console.error('[jdb-dap-server] Failed to parse message:', error);
      }
    }
  }

  /**
   * Handle a DAP message (request or response)
   */
  private async handleMessage(message: DebugProtocol.ProtocolMessage): Promise<void> {
    if (message.type === 'request') {
      await this.handleRequest(message as DebugProtocol.Request);
    }
  }

  /**
   * Handle a DAP request
   */
  private async handleRequest(request: DebugProtocol.Request): Promise<void> {
    try {
      switch (request.command) {
        case 'initialize':
          await this.handleInitialize(request as DebugProtocol.InitializeRequest);
          break;
        case 'launch':
          await this.handleLaunch(request as DebugProtocol.LaunchRequest);
          break;
        case 'attach':
          await this.handleAttach(request as DebugProtocol.AttachRequest);
          break;
        case 'setBreakpoints':
          await this.handleSetBreakpoints(request as DebugProtocol.SetBreakpointsRequest);
          break;
        case 'configurationDone':
          await this.handleConfigurationDone(request);
          break;
        case 'threads':
          await this.handleThreads(request);
          break;
        case 'stackTrace':
          await this.handleStackTrace(request as DebugProtocol.StackTraceRequest);
          break;
        case 'scopes':
          await this.handleScopes(request as DebugProtocol.ScopesRequest);
          break;
        case 'variables':
          await this.handleVariables(request as DebugProtocol.VariablesRequest);
          break;
        case 'continue':
          await this.handleContinue(request);
          break;
        case 'next':
          await this.handleNext(request);
          break;
        case 'stepIn':
          await this.handleStepIn(request);
          break;
        case 'stepOut':
          await this.handleStepOut(request);
          break;
        case 'evaluate':
          await this.handleEvaluate(request as DebugProtocol.EvaluateRequest);
          break;
        case 'disconnect':
          await this.handleDisconnect(request);
          break;
        default:
          this.sendErrorResponse(request, `Unknown command: ${request.command}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.sendErrorResponse(request, message);
    }
  }

  /**
   * Handle 'initialize' request
   */
  private async handleInitialize(request: DebugProtocol.InitializeRequest): Promise<void> {
    const response: DebugProtocol.InitializeResponse = {
      type: 'response',
      seq: this.sequenceNumber++,
      request_seq: request.seq,
      success: true,
      command: request.command,
      body: {
        supportsConfigurationDoneRequest: true,
        supportsFunctionBreakpoints: false,
        supportsConditionalBreakpoints: false,
        supportsEvaluateForHovers: true,
        supportsStepInTargetsRequest: false,
        supportsTerminateRequest: true
      }
    };

    this.sendMessage(response);
    this.sendEvent({ event: 'initialized' });
    this.initialized = true;
  }

  /**
   * Handle 'launch' request
   */
  private async handleLaunch(request: DebugProtocol.LaunchRequest): Promise<void> {
    const args = request.arguments as LaunchAttachArgs;

    // Store launch arguments for later use (e.g., stopOnEntry)
    this.launchArgs = args;

    // Create JDB configuration
    const jdbConfig: JdbConfig = {
      jdbPath: this.config.jdbPath,
      sourcePath: args.cwd || process.cwd(),
      mainClass: args.mainClass || 'Main',
      classpath: args.classpath || '.',
      vmArgs: args.vmArgs || [],
      programArgs: args.args || []
    };

    // Create and spawn JDB wrapper
    this.jdb = new JdbWrapper(jdbConfig);
    this.setupJdbEventHandlers();

    try {
      await this.jdb.spawn();

      this.sendResponse(request, {});
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to start jdb';
      this.sendErrorResponse(request, message);
    }
  }

  /**
   * Handle 'attach' request
   */
  private async handleAttach(request: DebugProtocol.AttachRequest): Promise<void> {
    const args = request.arguments as LaunchAttachArgs;

    // Set attach mode flag
    this.isAttachMode = true;

    // Validate required port argument
    if (!args.port) {
      this.sendErrorResponse(request, 'Port is required for attach mode');
      return;
    }

    // Create JDB configuration for attach mode
    const jdbConfig: JdbConfig = {
      jdbPath: this.config.jdbPath,
      sourcePath: args.sourcePath || '', // Don't default to cwd - let buildJdbArgs skip if empty
      mainClass: '', // Not needed for attach
      classpath: args.classpath || '', // Don't default to '.' - let buildJdbArgs skip if empty
      vmArgs: [],
      programArgs: [],
      attach: {
        host: args.hostName || args.host || 'localhost',
        port: args.port,
        timeout: args.timeout || 30000
      }
    };

    // Create JDB wrapper and attach
    this.jdb = new JdbWrapper(jdbConfig);
    this.setupJdbEventHandlers();

    try {
      await this.jdb.attach();

      // Send response
      // With suspend=y, the JVM is already suspended and waiting for commands
      // No need to send synthetic stopped event - the program will stay suspended
      // until the user explicitly calls continue_execution
      this.sendResponse(request, {});
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to attach to process';
      this.sendErrorResponse(request, message);
    }
  }

  /**
   * Setup event handlers for JDB events
   */
  private setupJdbEventHandlers(): void {
    if (!this.jdb) return;

    this.jdb.on('stopped', (event: JdbStoppedEvent) => {
      // Check if this is the entry stop we requested
      let reason = event.reason;
      if (this.isStoppingAtEntry) {
        reason = 'entry';
        this.isStoppingAtEntry = false; // Clear the flag after first stop
      }

      this.sendEvent({
        event: 'stopped',
        body: {
          reason: reason,
          threadId: event.threadId,
          allThreadsStopped: false
        }
      });
    });

    this.jdb.on('continued', () => {
      this.sendEvent({
        event: 'continued',
        body: {
          threadId: 1,
          allThreadsContinued: true
        }
      });
    });

    this.jdb.on('output', (text: string) => {
      this.sendEvent({
        event: 'output',
        body: {
          category: 'stdout',
          output: text
        }
      });
    });

    this.jdb.on('terminated', () => {
      this.sendEvent({ event: 'terminated' });
    });

    this.jdb.on('error', (error: Error) => {
      this.sendEvent({
        event: 'output',
        body: {
          category: 'stderr',
          output: `Error: ${error.message}\n`
        }
      });
    });
  }

  /**
   * Handle 'setBreakpoints' request
   */
  private async handleSetBreakpoints(request: DebugProtocol.SetBreakpointsRequest): Promise<void> {
    if (!this.jdb) {
      this.sendErrorResponse(request, 'jdb not initialized');
      return;
    }

    const args = request.arguments;
    const file = args.source.path!;
    const lines = args.breakpoints?.map(bp => bp.line) || [];

    // Clear existing breakpoints for this file
    const existing = this.breakpoints.get(file) || [];
    for (const bp of existing) {
      await this.jdb.clearBreakpoint(file, bp.line);
    }

    // Set new breakpoints
    const breakpoints: DebugProtocol.Breakpoint[] = [];
    const jdbBreakpoints: JdbBreakpoint[] = [];

    for (const line of lines) {
      try {
        const bp = await this.jdb.setBreakpoint(file, line);
        jdbBreakpoints.push(bp);

        breakpoints.push({
          verified: bp.verified,
          line: bp.line,
          source: args.source
        });
      } catch (error) {
        breakpoints.push({
          verified: false,
          line,
          source: args.source,
          message: error instanceof Error ? error.message : 'Failed to set breakpoint'
        });
      }
    }

    this.breakpoints.set(file, jdbBreakpoints);

    this.sendResponse(request, { breakpoints });
  }

  /**
   * Handle 'configurationDone' request
   */
  private async handleConfigurationDone(request: DebugProtocol.Request): Promise<void> {
    if (!this.jdb) {
      this.sendErrorResponse(request, 'jdb not initialized');
      return;
    }

    // Only run the program in launch mode, not in attach mode
    if (!this.isAttachMode) {
      // Check if stopOnEntry is requested
      const stopOnEntry = this.launchArgs?.stopOnEntry === true;

      if (stopOnEntry) {
        // Set flag to indicate we're stopping at entry
        this.isStoppingAtEntry = true;

        // Use jdb's "stop in <classname>.main" command
        // Need to get the fully qualified class name
        const programPath = this.launchArgs?.program;

        if (programPath) {
          // Extract FQN from the Java file
          const fqn = this.extractFullyQualifiedClassName(programPath);

          if (fqn) {
            const command = `stop in ${fqn}.main`;

            // Use executeCommand to set the breakpoint and wait for confirmation
            try {
              await this.jdb.executeCommand(command, 10000); // 10 second timeout
            } catch {
              // If setting the entry breakpoint fails, continue without it
              this.isStoppingAtEntry = false;
            }
          } else {
            this.isStoppingAtEntry = false;
          }
        } else {
          this.isStoppingAtEntry = false;
        }
      }

      // Start the program running
      await this.jdb.run();

      // Give jdb a moment to process the run command
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    this.sendResponse(request, {});
  }

  /**
   * Extract fully qualified class name from a Java file
   * E.g., reads "package com.example; class Foo" => "com.example.Foo"
   * E.g., reads "class Bar" (no package) => "Bar"
   */
  private extractFullyQualifiedClassName(filePath: string): string | null {
    try {
      // Get the simple class name from filename
      const basename = path.basename(filePath, '.java');

      // Read the file content
      const content = fs.readFileSync(filePath, 'utf-8');

      // Match package declaration: package com.example.package;
      const packageMatch = content.match(/^\s*package\s+([\w.]+)\s*;/m);

      if (packageMatch) {
        const packageName = packageMatch[1];
        return `${packageName}.${basename}`;
      } else {
        // No package declaration - class is in default package
        return basename;
      }
    } catch (error) {
      console.error('[jdb-dap-server] Error extracting FQN:', error);
      return null;
    }
  }

  /**
   * Handle 'threads' request
   */
  private async handleThreads(request: DebugProtocol.Request): Promise<void> {
    if (!this.jdb) {
      this.sendErrorResponse(request, 'jdb not initialized');
      return;
    }

    const threads = await this.jdb.getThreads();

    this.sendResponse(request, {
      threads: threads.map(t => ({
        id: t.id,
        name: t.name
      }))
    });
  }

  /**
   * Handle 'stackTrace' request
   */
  private async handleStackTrace(request: DebugProtocol.StackTraceRequest): Promise<void> {
    if (!this.jdb) {
      this.sendErrorResponse(request, 'jdb not initialized');
      return;
    }

    const frames = await this.jdb.getStackTrace();

    this.sendResponse(request, {
      stackFrames: frames.map((f: JdbStackFrame) => ({
        id: f.id,
        name: f.name,
        source: {
          name: f.file,
          path: f.file
        },
        line: f.line,
        column: 0
      })),
      totalFrames: frames.length
    });
  }

  /**
   * Handle 'scopes' request
   */
  private async handleScopes(request: DebugProtocol.ScopesRequest): Promise<void> {
    this.sendResponse(request, {
      scopes: [
        {
          name: 'Locals',
          variablesReference: 1,
          expensive: false
        }
      ]
    });
  }

  /**
   * Handle 'variables' request
   */
  private async handleVariables(request: DebugProtocol.VariablesRequest): Promise<void> {
    if (!this.jdb) {
      this.sendErrorResponse(request, 'jdb not initialized');
      return;
    }

    const variables = await this.jdb.getLocals();

    this.sendResponse(request, {
      variables: variables.map(v => ({
        name: v.name,
        value: v.value,
        type: v.type,
        variablesReference: v.expandable ? (parseInt(v.objectId || '0', 10)) : 0
      }))
    });
  }

  /**
   * Handle 'continue' request
   */
  private async handleContinue(request: DebugProtocol.Request): Promise<void> {
    if (!this.jdb) {
      this.sendErrorResponse(request, 'jdb not initialized');
      return;
    }

    await this.jdb.continue();
    this.sendResponse(request, { allThreadsContinued: true });
  }

  /**
   * Handle 'next' (step over) request
   */
  private async handleNext(request: DebugProtocol.Request): Promise<void> {
    if (!this.jdb) {
      this.sendErrorResponse(request, 'jdb not initialized');
      return;
    }

    await this.jdb.stepOver();
    this.sendResponse(request, {});
  }

  /**
   * Handle 'stepIn' request
   */
  private async handleStepIn(request: DebugProtocol.Request): Promise<void> {
    if (!this.jdb) {
      this.sendErrorResponse(request, 'jdb not initialized');
      return;
    }

    await this.jdb.stepIn();
    this.sendResponse(request, {});
  }

  /**
   * Handle 'stepOut' request
   */
  private async handleStepOut(request: DebugProtocol.Request): Promise<void> {
    if (!this.jdb) {
      this.sendErrorResponse(request, 'jdb not initialized');
      return;
    }

    await this.jdb.stepOut();
    this.sendResponse(request, {});
  }

  /**
   * Handle 'evaluate' request
   */
  private async handleEvaluate(request: DebugProtocol.EvaluateRequest): Promise<void> {
    if (!this.jdb) {
      this.sendErrorResponse(request, 'jdb not initialized');
      return;
    }

    try {
      const result = await this.jdb.evaluate(request.arguments.expression);
      this.sendResponse(request, {
        result,
        variablesReference: 0
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Evaluation failed';
      this.sendErrorResponse(request, message);
    }
  }

  /**
   * Handle 'disconnect' request
   */
  private async handleDisconnect(request: DebugProtocol.Request): Promise<void> {
    this.sendResponse(request, {});
    await this.cleanup();
    process.exit(0);
  }

  /**
   * Send a DAP response
   */
  private sendResponse(request: DebugProtocol.Request, body: unknown): void {
    const response: DebugProtocol.Response = {
      type: 'response',
      seq: this.sequenceNumber++,
      request_seq: request.seq,
      success: true,
      command: request.command,
      body
    };

    this.sendMessage(response);
  }

  /**
   * Send a DAP error response
   */
  private sendErrorResponse(request: DebugProtocol.Request, message: string): void {
    const response: DebugProtocol.Response = {
      type: 'response',
      seq: this.sequenceNumber++,
      request_seq: request.seq,
      success: false,
      command: request.command,
      message
    };

    this.sendMessage(response);
  }

  /**
   * Send a DAP event
   */
  private sendEvent(event: Partial<DebugProtocol.Event>): void {
    const fullEvent: DebugProtocol.Event = {
      type: 'event',
      seq: this.sequenceNumber++,
      event: event.event!,
      body: event.body
    };

    this.sendMessage(fullEvent);
  }

  /**
   * Send a DAP message to the client
   */
  private sendMessage(message: DebugProtocol.ProtocolMessage): void {
    if (!this.connection) {
      return;
    }

    const json = JSON.stringify(message);
    const header = `Content-Length: ${Buffer.byteLength(json, 'utf8')}\r\n\r\n`;
    this.connection.write(header + json, 'utf8');
  }

  /**
   * Cleanup resources
   */
  private async cleanup(): Promise<void> {
    if (this.jdb) {
      await this.jdb.kill();
      this.jdb = null;
    }

    if (this.connection) {
      this.connection.end();
      this.connection = null;
    }

    this.server.close();
  }
}

// Main entry point
const config = parseArgs();
const server = new JdbDapServer(config);
server.start();
