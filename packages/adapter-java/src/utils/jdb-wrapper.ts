/**
 * JDB Wrapper
 *
 * Manages a jdb (Java Debugger) process and provides a high-level API
 * for debugging operations. Handles command execution, output parsing,
 * and event emission.
 *
 * @since 1.0.0
 */
import { EventEmitter } from 'events';
import { spawn, ChildProcess } from 'child_process';
import {
  JdbParser,
  JdbStackFrame,
  JdbVariable,
  JdbThread
} from './jdb-parser.js';
import path from 'path';
import { readFileSync } from 'fs';

/**
 * Configuration for JDB wrapper
 */
export interface JdbConfig {
  /** Path to jdb executable */
  jdbPath: string;
  /** Path to Java source files */
  sourcePath: string;
  /** Main class to debug (for launch mode) */
  mainClass?: string;
  /** Classpath for the Java application */
  classpath?: string;
  /** VM arguments */
  vmArgs?: string[];
  /** Program arguments */
  programArgs?: string[];
  /** Attach configuration (for attach mode) */
  attach?: {
    /** Host to attach to (default: localhost) */
    host: string;
    /** Port to attach to */
    port: number;
    /** Connection timeout in milliseconds */
    timeout?: number;
  };
}

/**
 * Represents a breakpoint set in jdb
 */
export interface JdbBreakpoint {
  id: string;
  className: string;
  line: number;
  verified: boolean;
}

/**
 * Queued command waiting for execution
 */
interface QueuedCommand {
  command: string;
  resolve: (output: string) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

/**
 * Wrapper for jdb debugger process
 *
 * Events emitted:
 * - 'stopped': Emitted when execution stops (breakpoint, step, etc.)
 * - 'continued': Emitted when execution continues
 * - 'output': Emitted for program output
 * - 'terminated': Emitted when the debugged program exits
 * - 'error': Emitted on errors
 */
export class JdbWrapper extends EventEmitter {
  private process: ChildProcess | null = null;
  private outputBuffer = '';
  private commandQueue: QueuedCommand[] = [];
  private currentCommand: QueuedCommand | null = null;
  private commandOutput: string[] = [];
  private breakpoints = new Map<string, JdbBreakpoint>();
  private threads = new Map<number, JdbThread>();
  private ready = false;

  constructor(private config: JdbConfig) {
    super();
  }

  /**
   * Spawn the jdb process and initialize debugging (launch mode)
   */
  async spawn(): Promise<void> {
    if (!this.config.mainClass) {
      throw new Error('mainClass is required for launch mode');
    }
    return this.startJdbProcess(10000);
  }

  /**
   * Attach to a running JVM with debug agent
   */
  async attach(): Promise<void> {
    if (!this.config.attach) {
      throw new Error('Attach configuration is required for attach mode');
    }
    const timeout = this.config.attach.timeout || 30000;
    return this.startJdbProcess(timeout);
  }

  /**
   * Start the jdb process (common logic for spawn and attach)
   */
  private async startJdbProcess(timeout: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const args = this.buildJdbArgs();

      this.process = spawn(this.config.jdbPath, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: path.dirname(this.config.sourcePath)
      });

      if (!this.process.stdout || !this.process.stderr || !this.process.stdin) {
        reject(new Error('Failed to create jdb process pipes'));
        return;
      }

      // Handle stdout
      this.process.stdout.on('data', (data: Buffer) => {
        this.onStdout(data);
      });

      // Handle stderr (jdb outputs some info to stderr)
      this.process.stderr.on('data', (data: Buffer) => {
        this.onStderr(data);
      });

      // Handle process errors
      this.process.on('error', (error) => {
        this.emit('error', error);
        reject(error);
      });

      // Handle process exit
      this.process.on('exit', (code, signal) => {
        this.emit('terminated', { code, signal });
        this.cleanup();
      });

      // Wait for VM to be initialized
      const initTimeout = setTimeout(() => {
        reject(new Error(`jdb initialization timeout after ${timeout}ms`));
      }, timeout);

      const checkReady = () => {
        if (this.ready) {
          clearTimeout(initTimeout);
          resolve();
        }
      };

      // Check for initialization message
      this.on('vmStarted', () => {
        this.ready = true;
        checkReady();
      });

      // Also check if we get a prompt quickly
      setTimeout(() => {
        if (!this.ready && this.outputBuffer.includes('>')) {
          this.ready = true;
          this.emit('vmStarted');
          checkReady();
        }
      }, Math.min(2000, timeout / 2));
    });
  }

  /**
   * Build jdb command-line arguments
   */
  private buildJdbArgs(): string[] {
    const args: string[] = [];

    // Attach mode vs Launch mode
    if (this.config.attach) {
      // Attach to remote JVM
      // IMPORTANT: When using -attach, jdb does NOT accept -sourcepath or -classpath
      // These are "target VM arguments" that only work in launch mode
      const { host, port } = this.config.attach;
      args.push('-attach', `${host}:${port}`);
    } else {
      // Launch mode - main class is required
      if (!this.config.mainClass) {
        throw new Error('mainClass is required for launch mode');
      }

      // Source path and classpath are only valid in launch mode
      if (this.config.sourcePath && this.config.sourcePath.trim() !== '') {
        args.push('-sourcepath', this.config.sourcePath);
      }

      if (this.config.classpath && this.config.classpath.trim() !== '') {
        args.push('-classpath', this.config.classpath);
      }

      args.push(this.config.mainClass);

      // Program arguments (only for launch mode)
      if (this.config.programArgs && this.config.programArgs.length > 0) {
        args.push(...this.config.programArgs);
      }
    }

    return args;
  }

  /**
   * Handle stdout data from jdb
   */
  private onStdout(data: Buffer): void {
    const text = data.toString();
    this.outputBuffer += text;

    // Collect output for current command if one is executing
    if (this.currentCommand) {
      this.commandOutput.push(text);
    }

    // Check for special events in the accumulated buffer
    // This ensures we detect events even if they come in multiple chunks
    this.detectEvents(this.outputBuffer);

    // Check for command completion (prompt detected)
    if (JdbParser.isPrompt(text)) {
      this.handleCommandComplete();
    }

    // Emit as output
    this.emit('output', text);
  }

  /**
   * Handle stderr data from jdb
   */
  private onStderr(data: Buffer): void {
    const text = data.toString();
    this.outputBuffer += text;

    // Some jdb messages go to stderr
    // Check for events in the accumulated buffer
    this.detectEvents(this.outputBuffer);

    // Emit as output
    this.emit('output', text);
  }

  /**
   * Detect and emit events from jdb output
   */
  private detectEvents(text: string): void {
    // Check for stopped events (breakpoint, step)
    const stoppedEvent = JdbParser.parseStoppedEvent(text);
    if (stoppedEvent) {
      this.emit('stopped', stoppedEvent);
      return;
    }

    // Check for VM started
    if (JdbParser.isVMStarted(text)) {
      this.ready = true;
      this.emit('vmStarted');
      return;
    }

    // Check for termination
    if (JdbParser.isTerminated(text)) {
      this.emit('terminated', {});
      return;
    }

    // Check for errors
    const error = JdbParser.parseError(text);
    if (error) {
      this.emit('error', new Error(error));
    }
  }

  /**
   * Handle command completion when prompt is detected
   */
  private handleCommandComplete(): void {
    if (!this.currentCommand) {
      return;
    }

    // Collect output (exclude the prompt line)
    const output = this.commandOutput.join('\n');
    this.commandOutput = [];

    // Clear timeout
    clearTimeout(this.currentCommand.timeout);

    // Resolve the command
    this.currentCommand.resolve(output);
    this.currentCommand = null;

    // Process next command in queue
    this.processNextCommand();
  }

  /**
   * Execute a jdb command
   */
  async executeCommand(command: string, timeoutMs = 5000): Promise<string> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Command timeout: ${command}`));
        this.currentCommand = null;
        this.processNextCommand();
      }, timeoutMs);

      const queuedCommand: QueuedCommand = {
        command,
        resolve,
        reject,
        timeout
      };

      this.commandQueue.push(queuedCommand);

      // Start processing if not already processing
      if (!this.currentCommand) {
        this.processNextCommand();
      }
    });
  }

  /**
   * Process the next command in the queue
   */
  private processNextCommand(): void {
    if (this.currentCommand || this.commandQueue.length === 0) {
      return;
    }

    const command = this.commandQueue.shift()!;
    this.currentCommand = command;
    this.commandOutput = [];

    // Send command to jdb
    if (this.process && this.process.stdin) {
      this.process.stdin.write(command.command + '\n');
    } else {
      command.reject(new Error('jdb process not available'));
      this.currentCommand = null;
      this.processNextCommand();
    }
  }

  /**
   * Send a command directly to jdb without waiting for a response
   * Used for commands like 'resume' and 'cont' that don't return a prompt immediately
   */
  private sendCommandDirect(command: string): void {
    if (this.process && this.process.stdin) {
      // Emit diagnostic output
      this.emit('output', `[DIRECT COMMAND] ${command}\n`);
      this.process.stdin.write(command + '\n');
      // Ensure the command is flushed to jdb
      if (typeof this.process.stdin.uncork === 'function') {
        this.process.stdin.uncork();
      }
    } else {
      this.emit('output', `[DIRECT COMMAND FAILED] Process or stdin not available\n`);
    }
  }

  /**
   * Set a breakpoint at a specific line
   */
  async setBreakpoint(file: string, line: number): Promise<JdbBreakpoint> {
    const className = this.fileToClassName(file);
    const command = `stop at ${className}:${line}`;

    try {
      const output = await this.executeCommand(command);
      const result = JdbParser.parseBreakpointSet(output);

      const breakpoint: JdbBreakpoint = {
        id: `${className}:${line}`,
        className,
        line,
        verified: result !== null
      };

      if (result) {
        this.breakpoints.set(breakpoint.id, breakpoint);
      }

      return breakpoint;
    } catch {
      return {
        id: `${className}:${line}`,
        className,
        line,
        verified: false
      };
    }
  }

  /**
   * Clear a breakpoint
   */
  async clearBreakpoint(file: string, line: number): Promise<boolean> {
    const className = this.fileToClassName(file);
    const command = `clear ${className}:${line}`;
    const id = `${className}:${line}`;

    try {
      const output = await this.executeCommand(command);
      const cleared = JdbParser.parseBreakpointCleared(output);

      if (cleared) {
        this.breakpoints.delete(id);
      }

      return cleared;
    } catch {
      return false;
    }
  }

  /**
   * Get the current stack trace
   */
  async getStackTrace(): Promise<JdbStackFrame[]> {
    const output = await this.executeCommand('where');
    return JdbParser.parseStackTrace(output);
  }

  /**
   * Get local variables in the current frame
   */
  async getLocals(): Promise<JdbVariable[]> {
    const output = await this.executeCommand('locals');
    return JdbParser.parseLocals(output);
  }

  /**
   * Get list of threads
   */
  async getThreads(): Promise<JdbThread[]> {
    const output = await this.executeCommand('threads');
    const threads = JdbParser.parseThreads(output);

    // Update thread cache
    this.threads.clear();
    threads.forEach(thread => {
      this.threads.set(thread.id, thread);
    });

    return threads;
  }

  /**
   * Switch to a specific thread
   */
  async switchThread(threadId: number): Promise<void> {
    const thread = this.threads.get(threadId);
    if (!thread) {
      throw new Error(`Thread ${threadId} not found`);
    }

    // jdb's 'thread' command requires the decimal thread ID (converted from hex in 'threads' output)
    await this.executeCommand(`thread ${threadId}`);
  }

  /**
   * Continue execution
   * Use 'resume' which works in all cases (initial attach and after breakpoints)
   */
  async continue(): Promise<void> {
    // Note: resume doesn't return a prompt until the program stops,
    // so we send the command directly without waiting
    this.sendCommandDirect('resume');
    this.emit('continued');
  }

  /**
   * Step over the current line
   */
  async stepOver(): Promise<void> {
    // Step commands execute until next stop point, so don't wait for prompt
    this.sendCommandDirect('next');
  }

  /**
   * Step into a function
   */
  async stepIn(): Promise<void> {
    // Step commands execute until next stop point, so don't wait for prompt
    this.sendCommandDirect('step');
  }

  /**
   * Step out of the current function
   */
  async stepOut(): Promise<void> {
    // Step commands execute until next stop point, so don't wait for prompt
    this.sendCommandDirect('step up');
  }

  /**
   * Evaluate an expression
   */
  async evaluate(expression: string): Promise<string> {
    const output = await this.executeCommand(`print ${expression}`);
    // Extract the result (usually after "expression = ")
    const match = output.match(/=\s*(.+)$/m);
    return match ? match[1].trim() : output.trim();
  }

  /**
   * Run the program (start debugging)
   * Note: In normal cases, run doesn't return a prompt until the program stops.
   * However, if we've set a breakpoint, it will stop and return a prompt.
   * So we need to handle both cases - use sendCommandDirect for the async case.
   */
  async run(): Promise<void> {
    // Ensure command queue is clear before sending
    if (this.currentCommand) {
      // Wait for current command to finish
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    this.sendCommandDirect('run');
  }

  /**
   * Kill the jdb process
   */
  async kill(): Promise<void> {
    if (this.process) {
      this.process.kill('SIGTERM');

      // Force kill after 2 seconds if still alive
      setTimeout(() => {
        if (this.process && !this.process.killed) {
          this.process.kill('SIGKILL');
        }
      }, 2000);
    }

    this.cleanup();
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    this.ready = false;
    this.breakpoints.clear();
    this.threads.clear();
    this.commandQueue = [];
    this.currentCommand = null;
    this.outputBuffer = '';
  }

  /**
   * Convert file path to Java class name
   * TODO: This is simplified - needs package resolution
   */
  private fileToClassName(file: string): string {
    // Remove .java extension
    const basename = path.basename(file, '.java');

    try {
      // Read the file and extract package declaration
      const content = readFileSync(file, 'utf-8');

      // Match package declaration: package com.example.package;
      const packageMatch = content.match(/^\s*package\s+([\w.]+)\s*;/m);

      if (packageMatch) {
        const packageName = packageMatch[1];
        const fullClassName = `${packageName}.${basename}`;
        this.emit('output', `[DEBUG] Resolved class name: ${fullClassName}\n`);
        return fullClassName;
      } else {
        this.emit('output', `[DEBUG] No package found in ${file}, using basename: ${basename}\n`);
      }
    } catch (error) {
      // If we can't read the file, fall back to just the class name
      const msg = error instanceof Error ? error.message : String(error);
      this.emit('output', `[DEBUG] Error reading file ${file}: ${msg}\n`);
    }

    // Fallback: just return the class name without package
    this.emit('output', `[DEBUG] Fallback: returning basename ${basename}\n`);
    return basename;
  }

  /**
   * Check if jdb is ready for commands
   */
  isReady(): boolean {
    return this.ready;
  }

  /**
   * Get all breakpoints
   */
  getBreakpoints(): JdbBreakpoint[] {
    return Array.from(this.breakpoints.values());
  }
}
