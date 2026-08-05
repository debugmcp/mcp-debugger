#!/usr/bin/env node
/**
 * Mock Debug Adapter Process
 * 
 * This process simulates a DAP (Debug Adapter Protocol) server for testing.
 * It can communicate via stdin/stdout or TCP using the DAP protocol.
 * 
 * @since 2.0.0
 */
import { DebugProtocol } from '@vscode/debugprotocol';
import * as path from 'path';
import * as net from 'net';
import { Readable, Writable } from 'stream';

// Simple DAP connection implementation
class DAPConnection {
  private messageBuffer = '';
  
  constructor(
    private input: Readable = process.stdin,
    private output: Writable = process.stdout
  ) {}
  
  start(): void {
    this.input.on('data', (chunk: Buffer) => {
      this.messageBuffer += chunk.toString();
      this.processMessages();
    });
  }
  
  on(event: 'request' | 'disconnect', handler: (arg: DebugProtocol.Request) => void): void {
    if (event === 'request') {
      this.onRequest = handler;
    } else if (event === 'disconnect') {
      this.input.on('end', () => handler({} as DebugProtocol.Request));
      this.input.on('close', () => handler({} as DebugProtocol.Request));
    }
  }
  
  sendResponse(response: DebugProtocol.Response): void {
    this.sendMessage(response);
  }
  
  sendEvent(event: DebugProtocol.Event): void {
    this.sendMessage(event);
  }
  
  private onRequest?: (request: DebugProtocol.Request) => void;
  
  private processMessages(): void {
    while (true) {
      const idx = this.messageBuffer.indexOf('\r\n\r\n');
      if (idx === -1) break;
      
      const header = this.messageBuffer.substring(0, idx);
      const contentLengthMatch = header.match(/Content-Length: (\d+)/);
      if (!contentLengthMatch) {
        this.messageBuffer = this.messageBuffer.substring(idx + 4);
        continue;
      }
      
      const contentLength = parseInt(contentLengthMatch[1], 10);
      const messageStart = idx + 4;

      // Use byte-aware extraction: Content-Length is in bytes, not characters
      const remainingBuffer = Buffer.from(this.messageBuffer.substring(messageStart), 'utf8');
      if (remainingBuffer.length < contentLength) break;

      const messageContent = remainingBuffer.subarray(0, contentLength).toString('utf8');
      this.messageBuffer = remainingBuffer.subarray(contentLength).toString('utf8');
      
      try {
        const message = JSON.parse(messageContent) as DebugProtocol.Request;
        if (message.type === 'request' && this.onRequest) {
          this.onRequest(message);
        }
      } catch {
        // Ignore parse errors
      }
    }
  }
  
  private sendMessage(message: DebugProtocol.ProtocolMessage): void {
    const json = JSON.stringify(message);
    const contentLength = Buffer.byteLength(json, 'utf8');
    this.output.write(`Content-Length: ${contentLength}\r\n\r\n${json}`, 'utf8');
  }
}

function createConnection(input?: Readable, output?: Writable): DAPConnection {
  return new DAPConnection(input, output);
}

/**
 * Mock DAP server implementation
 */
class MockDebugAdapterProcess {
  private connection?: DAPConnection;
  private server?: net.Server;
  // Stored breakpoints carry logMessage so the run simulation can treat
  // logpoints as non-stopping (issue #235)
  private breakpoints = new Map<string, Array<DebugProtocol.Breakpoint & { logMessage?: string }>>();
  private variableHandles = new Map<number, { variables: Array<{ name: string; value: string; type: string }> }>();
  private nextVariableReference = 1000;
  private currentLine = 1;
  private threads = [{ id: 1, name: 'main' }];
  // Exception simulation state (issue #220): armed via setExceptionBreakpoints,
  // triggered once per launch for programs whose path matches /throws|error/i
  private exceptionFilters: string[] = [];
  private programPath = '';
  private exceptionSimulated = false;
  
  constructor() {
    // Parse command line arguments
    const args = process.argv.slice(2);
    let port: number | undefined;
    let host = 'localhost';
    let sessionId = 'mock-session';
    
    for (let i = 0; i < args.length; i++) {
      switch (args[i]) {
        case '--port':
          port = parseInt(args[i + 1], 10);
          i++;
          break;
        case '--host':
          host = args[i + 1];
          i++;
          break;
        case '--session':
          sessionId = args[i + 1];
          i++;
          break;
      }
    }
    
    // Log startup
    this.log(`Mock Debug Adapter Process started - session: ${sessionId}, host: ${host}, port: ${port || 'stdio'}`);
    
    if (port) {
      // Set up TCP server
      this.setupTCPServer(host, port);
    } else {
      // Use stdio
      this.connection = createConnection();
      this.setupConnection(this.connection);
      this.connection.start();
    }
  }
  
  private setupTCPServer(host: string, port: number): void {
    this.server = net.createServer((socket) => {
      this.log(`Client connected from ${socket.remoteAddress}:${socket.remotePort}`);
      
      // Create connection for this socket
      this.connection = createConnection(socket, socket);
      this.setupConnection(this.connection);
      this.connection.start();
      
      socket.on('close', () => {
        this.log('Client socket closed');
        // Don't exit the process, allow reconnections
      });
      
      socket.on('error', (err) => {
        this.log(`Socket error: ${err.message}`);
      });
    });
    
    this.server.listen(port, host, () => {
      this.log(`TCP server listening on ${host}:${port}`);
    });
    
    this.server.on('error', (err) => {
      this.log(`Server error: ${err.message}`);
      process.exit(1);
    });
  }
  
  private setupConnection(connection: DAPConnection): void {
    // Set up message handlers
    connection.on('request', this.handleRequest.bind(this));
    connection.on('disconnect', () => {
      this.log('Client disconnected');
      // For TCP connections, don't exit - allow reconnection
      if (!this.server) {
        process.exit(0);
      }
    });
  }
  
  private log(message: string): void {
    // Log to stderr so it doesn't interfere with protocol messages
    console.error(`[MockDAP] ${message}`);
  }
  
  private handleRequest(request: DebugProtocol.Request): void {
    this.log(`Received request: ${request.command}`);
    
    switch (request.command) {
      case 'initialize':
        this.handleInitialize(request as DebugProtocol.InitializeRequest);
        break;
        
      case 'configurationDone':
        this.handleConfigurationDone(request as DebugProtocol.ConfigurationDoneRequest);
        break;
        
      case 'launch':
        this.handleLaunch(request as DebugProtocol.LaunchRequest);
        break;
        
      case 'setBreakpoints':
        this.handleSetBreakpoints(request as DebugProtocol.SetBreakpointsRequest);
        break;

      case 'setExceptionBreakpoints':
        this.handleSetExceptionBreakpoints(request as DebugProtocol.SetExceptionBreakpointsRequest);
        break;
        
      case 'threads':
        this.handleThreads(request as DebugProtocol.ThreadsRequest);
        break;
        
      case 'stackTrace':
        this.handleStackTrace(request as DebugProtocol.StackTraceRequest);
        break;
        
      case 'scopes':
        this.handleScopes(request as DebugProtocol.ScopesRequest);
        break;
        
      case 'variables':
        this.handleVariables(request as DebugProtocol.VariablesRequest);
        break;
        
      case 'continue':
        this.handleContinue(request as DebugProtocol.ContinueRequest);
        break;
        
      case 'next':
        this.handleNext(request as DebugProtocol.NextRequest);
        break;
        
      case 'stepIn':
        this.handleStepIn(request as DebugProtocol.StepInRequest);
        break;
        
      case 'stepOut':
        this.handleStepOut(request as DebugProtocol.StepOutRequest);
        break;
        
      case 'pause':
        this.handlePause(request as DebugProtocol.PauseRequest);
        break;
        
      case 'evaluate':
        this.handleEvaluate(request);
        break;

      case 'exceptionInfo':
        this.handleExceptionInfo(request as DebugProtocol.ExceptionInfoRequest);
        break;

      case 'disconnect':
        this.handleDisconnect(request as DebugProtocol.DisconnectRequest);
        break;
        
      case 'terminate':
        this.handleTerminate(request as DebugProtocol.TerminateRequest);
        break;
        
      default:
        this.sendErrorResponse(request, 1000, `Unhandled command: ${request.command}`);
    }
  }
  
  private handleInitialize(request: DebugProtocol.InitializeRequest): void {
    const response: DebugProtocol.InitializeResponse = {
      seq: 0,
      type: 'response',
      request_seq: request.seq,
      command: request.command,
      success: true,
      body: {
        supportsConfigurationDoneRequest: true,
        supportsFunctionBreakpoints: false,
        supportsConditionalBreakpoints: true,
        supportsHitConditionalBreakpoints: false,
        supportsEvaluateForHovers: true,
        exceptionBreakpointFilters: [
          { filter: 'uncaught', label: 'Uncaught Exceptions', default: false },
          { filter: 'all', label: 'All Exceptions', default: false }
        ],
        supportsStepBack: false,
        supportsSetVariable: true,
        supportsRestartFrame: false,
        supportsGotoTargetsRequest: false,
        supportsStepInTargetsRequest: false,
        supportsCompletionsRequest: false,
        supportsModulesRequest: false,
        supportsRestartRequest: false,
        supportsExceptionOptions: false,
        supportsValueFormattingOptions: false,
        supportsExceptionInfoRequest: true,
        supportTerminateDebuggee: true,
        supportSuspendDebuggee: false,
        supportsDelayedStackTraceLoading: false,
        supportsLoadedSourcesRequest: false,
        supportsLogPoints: true,
        supportsTerminateThreadsRequest: false,
        supportsSetExpression: false,
        supportsTerminateRequest: true,
        supportsDataBreakpoints: false,
        supportsReadMemoryRequest: false,
        supportsWriteMemoryRequest: false,
        supportsDisassembleRequest: false,
        supportsCancelRequest: false,
        supportsBreakpointLocationsRequest: false,
        supportsClipboardContext: false,
        supportsSteppingGranularity: false,
        supportsInstructionBreakpoints: false,
        supportsExceptionFilterOptions: false,
        supportsSingleThreadExecutionRequests: false
      }
    };
    
    this.sendResponse(response);
    this.sendEvent({
      seq: 0,
      type: 'event',
      event: 'initialized'
    } as DebugProtocol.InitializedEvent);
  }
  
  private handleConfigurationDone(request: DebugProtocol.ConfigurationDoneRequest): void {
    this.sendResponse({
      seq: 0,
      type: 'response',
      request_seq: request.seq,
      command: request.command,
      success: true
    });
  }
  
  private handleSetExceptionBreakpoints(request: DebugProtocol.SetExceptionBreakpointsRequest): void {
    this.exceptionFilters = request.arguments?.filters ?? [];
    this.log(`Exception breakpoints set: ${JSON.stringify(this.exceptionFilters)}`);
    this.sendResponse({
      seq: 0,
      type: 'response',
      request_seq: request.seq,
      command: request.command,
      success: true
    });
  }

  /**
   * Whether to simulate an uncaught exception instead of running to
   * completion (issue #220). Double-gated: exception filters must be armed
   * AND the program path must look like a crashing fixture. Fires at most
   * once per launch so a continue past the exception terminates.
   */
  private shouldSimulateException(): boolean {
    return this.exceptionFilters.length > 0 &&
      !this.exceptionSimulated &&
      /throws|error/i.test(this.programPath);
  }

  /**
   * DAP exceptionInfo (issue #243): coherent with sendExceptionStopped so the
   * enrichment path can be exercised end-to-end against the mock adapter.
   */
  private handleExceptionInfo(request: DebugProtocol.ExceptionInfoRequest): void {
    this.sendResponse({
      seq: 0,
      type: 'response',
      request_seq: request.seq,
      command: request.command,
      success: true,
      body: {
        exceptionId: 'MockError',
        breakMode: 'unhandled',
        description: 'Mock uncaught exception',
        details: {
          message: 'Mock uncaught exception',
          typeName: 'MockError',
          fullTypeName: 'mock.MockError'
        }
      }
    } as DebugProtocol.ExceptionInfoResponse);
  }

  private sendExceptionStopped(): void {
    this.exceptionSimulated = true;
    this.log(`Simulating uncaught exception stop (filters: ${JSON.stringify(this.exceptionFilters)})`);
    this.sendEvent({
      seq: 0,
      type: 'event',
      event: 'stopped',
      body: {
        reason: 'exception',
        threadId: 1,
        allThreadsStopped: true,
        description: 'MockError',
        text: 'Mock uncaught exception'
      }
    } as DebugProtocol.StoppedEvent);
  }

  /**
   * Walk the sorted breakpoint list from a line: logpoint lines emit an
   * output event (naive {expr} interpolation) and do NOT stop; the first
   * plain breakpoint after the line is the next stop (issue #235).
   */
  private findNextStop(fromLine: number): (DebugProtocol.Breakpoint & { logMessage?: string }) | undefined {
    const allBreakpoints = Array.from(this.breakpoints.values())
      .flat()
      .filter(bp => bp.line !== undefined)
      .sort((a, b) => (a.line || 0) - (b.line || 0));

    for (const bp of allBreakpoints) {
      if ((bp.line || 0) <= fromLine) continue;
      if (bp.logMessage !== undefined) {
        const interpolated = bp.logMessage.replace(/\{[^}]*\}/g, '42');
        this.log(`Logpoint at line ${bp.line}: ${interpolated}`);
        this.sendEvent({
          seq: 0,
          type: 'event',
          event: 'output',
          body: { category: 'console', output: `${interpolated}\n` }
        } as DebugProtocol.OutputEvent);
        continue;
      }
      return bp;
    }
    return undefined;
  }

  private handleLaunch(request: DebugProtocol.LaunchRequest): void {
    const args = request.arguments as DebugProtocol.LaunchRequestArguments & { stopOnEntry?: boolean; program?: string };
    this.log(`Launching with args: ${JSON.stringify(args)}`);
    this.programPath = typeof args.program === 'string' ? args.program : '';
    this.exceptionSimulated = false;

    this.sendResponse({
      seq: 0,
      type: 'response',
      request_seq: request.seq,
      command: request.command,
      success: true
    });
    
    // If stopOnEntry is set, send a stopped event
    if (args.stopOnEntry) {
      setTimeout(() => {
        this.log(`Sending stopped event for stopOnEntry`);
        this.sendEvent({
          seq: 0,
          type: 'event',
          event: 'stopped',
          body: {
            reason: 'entry',
            threadId: 1,
            allThreadsStopped: true
          }
        } as DebugProtocol.StoppedEvent);
      }, 100);
    } else {
      this.log(`Running without stopOnEntry, will hit first breakpoint`);
      // Simulate running to the first stopping breakpoint (logpoints log
      // without stopping — see findNextStop)
      setTimeout(() => {
        const firstStop = this.findNextStop(0);

        if (firstStop) {
          this.currentLine = firstStop.line || 1;
          this.log(`Hit first breakpoint at line ${this.currentLine}`);
          this.sendEvent({
            seq: 0,
            type: 'event',
            event: 'stopped',
            body: {
              reason: 'breakpoint',
              threadId: 1,
              allThreadsStopped: true
            }
          } as DebugProtocol.StoppedEvent);
        } else if (this.shouldSimulateException()) {
          this.sendExceptionStopped();
        } else {
          this.log(`No breakpoints set, program would run to completion`);
          // exited first, then terminated — matches real adapters (debugpy);
          // the SessionManager tears down its handlers on 'terminated'
          this.sendEvent({
            seq: 0,
            type: 'event',
            event: 'exited',
            body: {
              exitCode: this.exceptionSimulated ? 1 : 0
            }
          } as DebugProtocol.ExitedEvent);

          this.sendEvent({
            seq: 0,
            type: 'event',
            event: 'terminated'
          } as DebugProtocol.TerminatedEvent);
        }
      }, 200);
    }
  }
  
  private handleSetBreakpoints(request: DebugProtocol.SetBreakpointsRequest): void {
    const args = request.arguments;
    const breakpoints: DebugProtocol.Breakpoint[] = [];
    
    if (args.breakpoints) {
      for (const bp of args.breakpoints) {
        breakpoints.push({
          id: Math.floor(Math.random() * 100000),
          verified: true,
          line: bp.line,
          source: args.source,
          // Retained for the run simulation: logpoint lines log instead of stopping
          ...(bp.logMessage !== undefined ? { logMessage: bp.logMessage } : {})
        } as DebugProtocol.Breakpoint & { logMessage?: string });
      }
    }

    this.breakpoints.set(args.source?.path || 'unknown', breakpoints);
    
    this.sendResponse({
      seq: 0,
      type: 'response',
      request_seq: request.seq,
      command: request.command,
      success: true,
      body: {
        breakpoints
      }
    });
  }
  
  private handleThreads(request: DebugProtocol.ThreadsRequest): void {
    this.sendResponse({
      seq: 0,
      type: 'response',
      request_seq: request.seq,
      command: request.command,
      success: true,
      body: {
        threads: this.threads
      }
    });
  }
  
  private handleStackTrace(request: DebugProtocol.StackTraceRequest): void {
    const stackFrames: DebugProtocol.StackFrame[] = [
      {
        id: 0,
        name: 'main',
        source: {
          name: 'main.mock',
          path: path.join(process.cwd(), 'main.mock')
        },
        line: this.currentLine,
        column: 0
      },
      {
        id: 1,
        name: 'mockFunction',
        source: {
          name: 'lib.mock',
          path: path.join(process.cwd(), 'lib.mock')
        },
        line: 42,
        column: 0
      }
    ];
    
    this.sendResponse({
      seq: 0,
      type: 'response',
      request_seq: request.seq,
      command: request.command,
      success: true,
      body: {
        stackFrames,
        totalFrames: stackFrames.length
      }
    });
  }
  
  private handleScopes(request: DebugProtocol.ScopesRequest): void {
    const scopes: DebugProtocol.Scope[] = [
      {
        name: 'Locals',
        variablesReference: this.getOrCreateVariableReference({
          variables: [
            { name: 'x', value: '10', type: 'int' },
            { name: 'y', value: '20', type: 'int' },
            { name: 'result', value: '30', type: 'int' }
          ]
        }),
        expensive: false
      },
      {
        name: 'Globals',
        variablesReference: this.getOrCreateVariableReference({
          variables: [
            { name: '__name__', value: '"__main__"', type: 'str' },
            { name: '__file__', value: '"mock-adapter-process.ts"', type: 'str' }
          ]
        }),
        expensive: false
      }
    ];
    
    this.sendResponse({
      seq: 0,
      type: 'response',
      request_seq: request.seq,
      command: request.command,
      success: true,
      body: { scopes }
    });
  }
  
  private handleVariables(request: DebugProtocol.VariablesRequest): void {
    const args = request.arguments;
    const data = this.variableHandles.get(args.variablesReference);
    const variables: DebugProtocol.Variable[] = [];
    
    if (data && data.variables) {
      for (const v of data.variables) {
        variables.push({
          name: v.name,
          value: v.value,
          type: v.type,
          variablesReference: 0
        });
      }
    }
    
    this.sendResponse({
      seq: 0,
      type: 'response',
      request_seq: request.seq,
      command: request.command,
      success: true,
      body: { variables }
    });
  }
  
  private handleEvaluate(request: DebugProtocol.Request): void {
    this.sendResponse({
      seq: 0,
      type: 'response',
      request_seq: request.seq,
      command: request.command,
      success: true,
      body: {
        result: 'mock_value',
        type: 'string',
        variablesReference: 0
      }
    });
  }

  private handleContinue(request: DebugProtocol.ContinueRequest): void {
    this.sendResponse({
      seq: 0,
      type: 'response',
      request_seq: request.seq,
      command: request.command,
      success: true,
      body: {
        allThreadsContinued: true
      }
    });
    
    // Simulate hitting a breakpoint or terminating (logpoints log without
    // stopping — see findNextStop)
    setTimeout(() => {
      const nextBreakpoint = this.findNextStop(this.currentLine);

      this.log(`Next stopping breakpoint after line ${this.currentLine}: ${nextBreakpoint ? nextBreakpoint.line : 'none'}`);

      if (nextBreakpoint && nextBreakpoint.line) {
        // Hit the next breakpoint
        this.currentLine = nextBreakpoint.line;
        this.log(`Stopping at breakpoint on line ${this.currentLine}`);
        this.sendEvent({
          seq: 0,
          type: 'event',
          event: 'stopped',
          body: {
            reason: 'breakpoint',
            threadId: 1,
            allThreadsStopped: true
          }
        } as DebugProtocol.StoppedEvent);
      } else if (this.shouldSimulateException()) {
        // Crash before completion: uncaught exception past the last breakpoint
        this.sendExceptionStopped();
      } else {
        // No more breakpoints - program terminated
        this.log(`No more breakpoints after line ${this.currentLine}, terminating program`);
        // exited first, then terminated — matches real adapters (debugpy);
        // the SessionManager tears down its handlers on 'terminated'
        this.sendEvent({
          seq: 0,
          type: 'event',
          event: 'exited',
          body: {
            // An uncaught exception exits non-zero once continued past
            exitCode: this.exceptionSimulated ? 1 : 0
          }
        } as DebugProtocol.ExitedEvent);

        this.sendEvent({
          seq: 0,
          type: 'event',
          event: 'terminated'
        } as DebugProtocol.TerminatedEvent);
      }
    }, 200);
  }
  
  private handleNext(request: DebugProtocol.NextRequest): void {
    this.currentLine++;
    
    this.sendResponse({
      seq: 0,
      type: 'response',
      request_seq: request.seq,
      command: request.command,
      success: true
    });
    
    setTimeout(() => {
      this.sendEvent({
        seq: 0,
        type: 'event',
        event: 'stopped',
        body: {
          reason: 'step',
          threadId: 1,
          allThreadsStopped: true
        }
      } as DebugProtocol.StoppedEvent);
    }, 50);
  }
  
  private handleStepIn(request: DebugProtocol.StepInRequest): void {
    this.currentLine++;
    this.sendResponse({
      seq: 0,
      type: 'response',
      request_seq: request.seq,
      command: request.command,
      success: true
    });
    
    setTimeout(() => {
      this.sendEvent({
        seq: 0,
        type: 'event',
        event: 'stopped',
        body: {
          reason: 'step',
          threadId: 1,
          allThreadsStopped: true
        }
      } as DebugProtocol.StoppedEvent);
    }, 50);
  }
  
  private handleStepOut(request: DebugProtocol.StepOutRequest): void {
    this.currentLine++;
    this.sendResponse({
      seq: 0,
      type: 'response',
      request_seq: request.seq,
      command: request.command,
      success: true
    });
    
    setTimeout(() => {
      this.sendEvent({
        seq: 0,
        type: 'event',
        event: 'stopped',
        body: {
          reason: 'step',
          threadId: 1,
          allThreadsStopped: true
        }
      } as DebugProtocol.StoppedEvent);
    }, 50);
  }
  
  private handlePause(request: DebugProtocol.PauseRequest): void {
    this.sendResponse({
      seq: 0,
      type: 'response',
      request_seq: request.seq,
      command: request.command,
      success: true
    });
    
    this.sendEvent({
      seq: 0,
      type: 'event',
      event: 'stopped',
      body: {
        reason: 'pause',
        threadId: 1,
        allThreadsStopped: true
      }
    } as DebugProtocol.StoppedEvent);
  }
  
  private handleDisconnect(request: DebugProtocol.DisconnectRequest): void {
    this.sendResponse({
      seq: 0,
      type: 'response',
      request_seq: request.seq,
      command: request.command,
      success: true
    });

    // In TCP server mode, don't exit the process on disconnect
    if (this.server) return;

    setTimeout(() => {
      process.exit(0);
    }, 100);
  }
  
  private handleTerminate(request: DebugProtocol.TerminateRequest): void {
    this.sendResponse({
      seq: 0,
      type: 'response',
      request_seq: request.seq,
      command: request.command,
      success: true
    });

    this.sendEvent({
      seq: 0,
      type: 'event',
      event: 'terminated'
    } as DebugProtocol.TerminatedEvent);

    // In TCP server mode, don't exit the process on terminate
    if (this.server) return;

    setTimeout(() => {
      process.exit(0);
    }, 100);
  }
  
  private sendResponse(response: DebugProtocol.Response): void {
    if (this.connection) {
      this.connection.sendResponse(response);
    }
  }
  
  private sendEvent(event: DebugProtocol.Event): void {
    if (this.connection) {
      this.connection.sendEvent(event);
    }
  }
  
  private sendErrorResponse(request: DebugProtocol.Request, id: number, message: string): void {
    const response: DebugProtocol.Response = {
      seq: 0,
      type: 'response',
      request_seq: request.seq,
      command: request.command,
      success: false,
      message,
      body: {
        error: {
          id,
          format: message
        }
      }
    };
    this.sendResponse(response);
  }
  
  private getOrCreateVariableReference(data: { variables: Array<{ name: string; value: string; type: string }> }): number {
    const ref = this.nextVariableReference++;
    this.variableHandles.set(ref, data);
    return ref;
  }
}

// Start the mock debug adapter process
new MockDebugAdapterProcess();
