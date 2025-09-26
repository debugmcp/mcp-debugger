/**
 * Production implementations of process launcher interfaces
 * These delegate to the existing ProcessManager for actual process operations
 */
import { EventEmitter } from 'events';
/**
 * Adapter to wrap IChildProcess as IProcess
 * Provides a cleaner interface while delegating to the underlying child process
 */
class ProcessAdapter extends EventEmitter {
    childProcess;
    _exitCode = null;
    _signalCode = null;
    childProcessListeners = []; // eslint-disable-line @typescript-eslint/no-explicit-any
    constructor(childProcess) {
        super();
        this.childProcess = childProcess;
        // Create event handlers
        const exitHandler = (code, signal) => {
            this._exitCode = code;
            this._signalCode = signal;
            this.emit('exit', code, signal);
        };
        const closeHandler = (code, signal) => {
            this.emit('close', code, signal);
        };
        const errorHandler = (error) => {
            this.emit('error', error);
        };
        const spawnHandler = () => {
            this.emit('spawn');
        };
        const messageHandler = (message) => {
            this.emit('message', message);
        };
        // Add listeners and track them
        childProcess.on('exit', exitHandler);
        childProcess.on('close', closeHandler);
        childProcess.on('error', errorHandler);
        childProcess.on('spawn', spawnHandler);
        childProcess.on('message', messageHandler);
        // Track all listeners for cleanup
        this.childProcessListeners.push({ event: 'exit', listener: exitHandler }, { event: 'close', listener: closeHandler }, { event: 'error', listener: errorHandler }, { event: 'spawn', listener: spawnHandler }, { event: 'message', listener: messageHandler });
        // Add a default error handler to prevent unhandled errors
        // This ensures that errors don't throw if no other handlers are attached
        this.on('error', () => {
            // Default error handler - prevents Node.js from throwing
            // Actual error handling should be done by subclasses or external handlers
        });
    }
    get pid() {
        return this.childProcess.pid;
    }
    get stdin() {
        return this.childProcess.stdin;
    }
    get stdout() {
        return this.childProcess.stdout;
    }
    get stderr() {
        return this.childProcess.stderr;
    }
    get killed() {
        return this.childProcess.killed;
    }
    get exitCode() {
        return this._exitCode;
    }
    get signalCode() {
        return this._signalCode;
    }
    send(message) {
        return this.childProcess.send(message);
    }
    kill(signal) {
        try {
            // If the process has a pid, try to kill the entire process group
            if (this.childProcess.pid && process.platform !== 'win32') {
                try {
                    // Kill the process group (negative PID)
                    process.kill(-this.childProcess.pid, signal || 'SIGTERM');
                }
                catch {
                    // Fallback to killing just the process
                    return this.childProcess.kill(signal);
                }
            }
            return this.childProcess.kill(signal);
        }
        catch {
            // Process may already be dead
            return false;
        }
    }
}
/**
 * Production implementation of IProcessLauncher
 */
export class ProcessLauncherImpl {
    processManager;
    constructor(processManager) {
        this.processManager = processManager;
    }
    launch(command, args, options) {
        const childProcess = this.processManager.spawn(command, args, options);
        return new ProcessAdapter(childProcess);
    }
}
/**
 * Production implementation of IDebugTargetLauncher
 */
export class DebugTargetLauncherImpl {
    processLauncher;
    networkManager;
    constructor(processLauncher, networkManager) {
        this.processLauncher = processLauncher;
        this.networkManager = networkManager;
    }
    async launchPythonDebugTarget(scriptPath, args, pythonPath = 'python', debugPort) {
        // Find a free port if not specified
        const port = debugPort || await this.networkManager.findFreePort();
        // Launch Python with debugpy
        const debugArgs = [
            '-m', 'debugpy',
            '--listen', `127.0.0.1:${port}`,
            '--wait-for-client',
            scriptPath,
            ...args
        ];
        // No cwd manipulation - let the process inherit the current working directory
        const debugProcess = this.processLauncher.launch(pythonPath, debugArgs);
        return {
            process: debugProcess,
            debugPort: port,
            terminate: async () => {
                return new Promise((resolve) => {
                    if (debugProcess.killed) {
                        resolve();
                        return;
                    }
                    debugProcess.once('exit', () => resolve());
                    debugProcess.kill('SIGTERM');
                    // Force kill after timeout
                    setTimeout(() => {
                        if (!debugProcess.killed) {
                            debugProcess.kill('SIGKILL');
                        }
                        resolve();
                    }, 5000);
                });
            }
        };
    }
}
/**
 * Proxy process adapter that adds proxy-specific functionality
 */
class ProxyProcessAdapter extends ProcessAdapter {
    sessionId;
    initializationPromise;
    initializationResolve;
    initializationReject;
    initializationState = 'none';
    initializationCleanup;
    disposed = false;
    promiseId;
    constructor(childProcess, sessionId) {
        super(childProcess);
        this.sessionId = sessionId;
        // Create a unique ID for this adapter's promises for debugging
        this.promiseId = `ProxyProcess-${sessionId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        // NO promise creation here - wait for waitForInitialization()
        // Set up early exit handler
        this.once('exit', this.handleEarlyExit.bind(this));
        // Set up error handling immediately to prevent unhandled errors
        // This must be done in the constructor to catch any early errors
        this.setupErrorHandling();
    }
    setupErrorHandling() {
        // Override error handling to support DAP spec
        // Note: We must handle errors to prevent Node.js from throwing unhandled errors
        this.on('error', () => {
            if (this.initializationState === 'waiting') {
                // Both reject promise AND emit event (DAP spec requirement)
                // The failInitialization will reject the promise, but the error event
                // will still be emitted for other listeners
                // Don't pass the error directly - this will be handled by exit event
            }
            // Error is handled - prevent default throw behavior
        });
    }
    createInitializationPromise(timeout) {
        // Log promise creation for debugging
        if (process.env.DEBUG_PROMISES || process.env.DEBUG_PROMISE_LEAKS) {
            console.error(`[DEBUG] Creating initialization promise [ID: ${this.promiseId}, Timeout: ${timeout}ms]`);
            // Enhanced tracking for test debugging
            if (process.env.NODE_ENV === 'test' && process.env.DEBUG_PROMISE_LEAKS) {
                const testName = this.sessionId.match(/session-([^-]+(?:-[^-]+)*)/)?.[1] || 'unknown';
                console.error(`[DEBUG] Promise created by test: ${testName}`);
                console.error(`[DEBUG] Stack trace:`, new Error().stack);
            }
        }
        const promise = new Promise((resolve, reject) => {
            this.initializationResolve = resolve;
            this.initializationReject = reject;
            // Set up message handler
            const messageHandler = (message) => {
                const msg = message;
                if (msg?.type === 'status' &&
                    (msg.status === 'adapter_configured_and_launched' ||
                        msg.status === 'dry_run_complete')) {
                    this.completeInitialization();
                }
            };
            this.on('message', messageHandler);
            // Set up timeout
            const timeoutId = setTimeout(() => {
                if (this.initializationState === 'waiting') {
                    this.failInitialization(new Error(`Proxy initialization timeout [Promise ID: ${this.promiseId}]`));
                }
            }, timeout);
            // Store cleanup info
            this.initializationCleanup = () => {
                this.removeListener('message', messageHandler);
                clearTimeout(timeoutId);
            };
        });
        // Add a default catch handler to prevent unhandled rejection
        // This will be overridden when the caller awaits or catches the promise
        // IMPORTANT: We must handle rejections that occur from timeouts or dispose
        promise.catch((error) => {
            // Log the error if debugging is enabled
            if (process.env.DEBUG_PROMISES) {
                console.error(`[DEBUG] Promise rejection handled internally [ID: ${this.promiseId}]:`, error?.message);
            }
            // Silently handle rejection to prevent unhandled rejection warnings
            // The actual error handling is done by the caller
        });
        return promise;
    }
    completeInitialization() {
        if (this.initializationState !== 'waiting')
            return;
        this.initializationState = 'completed';
        if (process.env.DEBUG_PROMISES || process.env.DEBUG_PROMISE_LEAKS) {
            console.error(`[DEBUG] Completing initialization [ID: ${this.promiseId}]`);
        }
        if (this.initializationResolve) {
            this.initializationResolve();
            this.initializationResolve = undefined;
            this.initializationReject = undefined;
        }
        this.cleanupInitialization();
    }
    failInitialization(error) {
        if (this.initializationState !== 'waiting')
            return;
        this.initializationState = 'failed';
        if (process.env.DEBUG_PROMISES || process.env.DEBUG_PROMISE_LEAKS) {
            console.error(`[DEBUG] Failing initialization [ID: ${this.promiseId}]: ${error.message}`);
        }
        // Clear references first to prevent any re-entry
        const rejectFn = this.initializationReject;
        this.initializationResolve = undefined;
        this.initializationReject = undefined;
        // Clean up before rejecting to ensure no double-rejection from cleanup
        this.cleanupInitialization();
        // Now safely reject if we had a reject function
        if (rejectFn) {
            rejectFn(error);
        }
    }
    cleanupInitialization() {
        if (this.initializationCleanup) {
            this.initializationCleanup();
            this.initializationCleanup = undefined;
        }
    }
    handleEarlyExit() {
        if (this.initializationState === 'none') {
            // Process exited without initialization being requested
            // Mark as failed to prevent future initialization attempts
            this.initializationState = 'failed';
        }
        // dispose() will handle the rejection if we're waiting for initialization
        this.dispose();
    }
    dispose() {
        if (this.disposed)
            return;
        this.disposed = true;
        // If we're waiting for initialization, fail it gracefully to avoid unhandled rejection
        if (this.initializationState === 'waiting') {
            // Use failInitialization to handle this cleanly
            this.failInitialization(new Error(`Proxy process exited before initialization [Promise ID: ${this.promiseId}]`));
        }
        else {
            // Clean up initialization resources
            this.cleanupInitialization();
        }
        // Remove all listeners from this adapter
        this.removeAllListeners();
        // Remove listeners from the underlying childProcess
        for (const { event, listener } of this.childProcessListeners) {
            this.childProcess.removeListener(event, listener);
        }
        this.childProcessListeners = [];
    }
    sendCommand(command) {
        // Send object directly - Node.js IPC will handle serialization
        this.send(command);
    }
    async waitForInitialization(timeout = 30000) {
        // Handle completed states
        if (this.initializationState === 'completed') {
            return; // Already initialized
        }
        if (this.initializationState === 'failed') {
            throw new Error('Initialization already completed or failed');
        }
        // Handle concurrent calls - return existing promise if in progress
        if (this.initializationState === 'waiting' && this.initializationPromise) {
            return this.initializationPromise;
        }
        // Create promise only when first requested
        if (!this.initializationPromise) {
            this.initializationState = 'waiting';
            this.initializationPromise = this.createInitializationPromise(timeout);
        }
        return this.initializationPromise;
    }
    kill(signal) {
        if (this.killed || this.disposed) {
            return false; // Already killed or disposed
        }
        // If waiting for initialization, fail it
        if (this.initializationState === 'waiting') {
            this.failInitialization(new Error('Process killed during initialization'));
        }
        const result = super.kill(signal);
        // Ensure disposal happens after kill
        if (result) {
            this.once('exit', () => this.dispose());
        }
        return result;
    }
}
/**
 * Production implementation of IProxyProcessLauncher
 */
export class ProxyProcessLauncherImpl {
    processLauncher;
    constructor(processLauncher) {
        this.processLauncher = processLauncher;
    }
    launchProxy(proxyScriptPath, sessionId, env) {
        const diagnosticFlags = ['--trace-uncaught', '--trace-exit'];
        const args = [...diagnosticFlags, proxyScriptPath];
        // Convert process.env to ensure all values are strings
        // Filter out test-related environment variables to ensure proxy runs normally
        const processEnv = {};
        if (env) {
            Object.assign(processEnv, env);
        }
        else {
            for (const [key, value] of Object.entries(process.env)) {
                if (value !== undefined) {
                    // Skip test-related environment variables
                    if (key === 'NODE_ENV' || key === 'VITEST' || key === 'JEST_WORKER_ID') {
                        continue;
                    }
                    processEnv[key] = value;
                }
            }
        }
        // Ensure the proxy knows it's not in test mode
        delete processEnv.NODE_ENV;
        delete processEnv.VITEST;
        delete processEnv.JEST_WORKER_ID;
        const options = {
            stdio: ['pipe', 'pipe', 'pipe', 'ipc'], // eslint-disable-line @typescript-eslint/no-explicit-any -- Required for Node.js StdioOptions IPC compatibility
            env: processEnv,
            cwd: process.cwd(), // Ensure proxy runs from the MCP server's working directory
            // Create new process group on Unix systems to ensure all child processes can be killed together
            detached: process.platform !== 'win32'
        };
        const launchedProcess = this.processLauncher.launch(process.execPath, args, options);
        // Cast to ProcessAdapter to access the underlying child process
        const processAdapter = launchedProcess;
        return new ProxyProcessAdapter(processAdapter['childProcess'], sessionId);
    }
}
/**
 * Production implementation of IProcessLauncherFactory
 */
export class ProcessLauncherFactoryImpl {
    processManager;
    networkManager;
    constructor(processManager, networkManager) {
        this.processManager = processManager;
        this.networkManager = networkManager;
    }
    createProcessLauncher() {
        return new ProcessLauncherImpl(this.processManager);
    }
    createDebugTargetLauncher() {
        const processLauncher = this.createProcessLauncher();
        return new DebugTargetLauncherImpl(processLauncher, this.networkManager);
    }
    createProxyProcessLauncher() {
        const processLauncher = this.createProcessLauncher();
        return new ProxyProcessLauncherImpl(processLauncher);
    }
}
//# sourceMappingURL=process-launcher-impl.js.map