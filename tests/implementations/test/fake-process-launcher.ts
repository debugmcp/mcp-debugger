/**
 * Test implementations of process launcher interfaces
 * These provide deterministic, controllable behavior for unit testing
 */

import { EventEmitter } from 'events';
import { PassThrough } from 'stream';
import {
  IProcess,
  IProxyProcessLauncher,
  IProxyProcess
} from '../../../src/interfaces/process-interfaces.js';

/**
 * Fake process implementation for testing
 * Provides controllable behavior without spawning real processes
 */
export class FakeProcess extends EventEmitter implements IProcess {
  pid = 12345;
  stdin = new PassThrough() as any;
  stdout = new PassThrough() as any;
  stderr = new PassThrough() as any;
  
  private _killed = false;
  private _exitCode: number | null = null;
  private _signalCode: string | null = null;
  
  get killed(): boolean {
    return this._killed;
  }
  
  get exitCode(): number | null {
    return this._exitCode;
  }
  
  get signalCode(): string | null {
    return this._signalCode;
  }
  
  send(message: any): boolean {
    if (this._killed) return false;
    // Emit message event on next tick to simulate async IPC
    process.nextTick(() => this.emit('message', message));
    return true;
  }
  
  kill(signal = 'SIGTERM'): boolean {
    if (this._killed) return false;
    this._killed = true;
    this._signalCode = signal;
    process.nextTick(() => {
      this.emit('exit', 0, signal);
      this.emit('close', 0, signal);
    });
    return true;
  }
  
  // Test helpers
  simulateOutput(data: string): void {
    this.stdout.push(data);
  }
  
  simulateError(data: string): void {
    this.stderr.push(data);
  }
  
  simulateExit(code: number, signal?: string): void {
    this._exitCode = code;
    this._signalCode = signal || null;
    this._killed = true;
    this.emit('exit', code, signal);
    this.emit('close', code, signal);
  }
  
  simulateSpawn(): void {
    process.nextTick(() => this.emit('spawn'));
  }
  
  simulateProcessError(error: Error): void {
    this.emit('error', error);
  }
  
  simulateMessage(message: any): void {
    this.emit('message', message);
  }
}

/**
 * Fake proxy process implementation for testing
 */
export class FakeProxyProcess extends FakeProcess implements IProxyProcess {
  public sentCommands: object[] = [];
  
  constructor(public readonly sessionId: string) {
    super();
  }
  
  sendCommand(command: object): void {
    this.sentCommands.push(command);
    const messageStr = JSON.stringify(command);
    this.send(messageStr);
  }
  
  async waitForInitialization(timeout = 30000): Promise<void> {
    // Simulate successful initialization by default
    return Promise.resolve();
  }
  
  // Test helper: simulate initialization completion
  simulateInitialization(): void {
    this.simulateMessage({
      type: 'status',
      sessionId: this.sessionId,
      status: 'adapter_configured_and_launched'
    });
  }
  
  // Test helper: simulate initialization failure
  simulateInitializationFailure(error: string): void {
    this.simulateMessage({
      type: 'error',
      sessionId: this.sessionId,
      message: error
    });
  }
}

/**
 * Fake implementation of IProxyProcessLauncher for testing
 */
export class FakeProxyProcessLauncher implements IProxyProcessLauncher {
  public launchedProxies: Array<{
    proxyScriptPath: string;
    sessionId: string;
    env?: Record<string, string>;
    process: FakeProxyProcess;
  }> = [];
  
  private nextProxy: FakeProxyProcess | undefined;
  
  launchProxy(
    proxyScriptPath: string,
    sessionId: string,
    env?: Record<string, string>
  ): IProxyProcess {
    const isPreppedProxy = !!this.nextProxy;
    const proxy = this.nextProxy || new FakeProxyProcess(sessionId);
    this.nextProxy = undefined;

    this.launchedProxies.push({ proxyScriptPath, sessionId, env, process: proxy });

    // Simulate spawn event
    proxy.simulateSpawn();

    // Set up automatic init-received response for non-prepped proxies
    if (!isPreppedProxy) {
      const originalSendCommand = proxy.sendCommand.bind(proxy);
      proxy.sendCommand = (command: any) => {
        originalSendCommand(command);
        // When init command is received, send init_received acknowledgment
        if (command.cmd === 'init') {
          process.nextTick(() => {
            proxy.simulateMessage({
              type: 'status',
              status: 'init_received',
              sessionId: command.sessionId || proxy.sessionId
            });
          });
        }
      };
    }

    return proxy;
  }
  
  // Test helper: prepare a specific proxy for the next launch
  prepareProxy(setup: (proxy: FakeProxyProcess) => void): void {
    const proxy = new FakeProxyProcess('test-session');
    setup(proxy);
    this.nextProxy = proxy;
  }
  
  // Test helper: get the last launched proxy
  getLastLaunchedProxy(): FakeProxyProcess | undefined {
    const last = this.launchedProxies[this.launchedProxies.length - 1];
    return last?.process;
  }
  
  // Test helper: reset state
  reset(): void {
    this.launchedProxies = [];
    this.nextProxy = undefined;
  }
}
