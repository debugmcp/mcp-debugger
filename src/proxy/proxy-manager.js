/**
 * ProxyManager - Handles spawning and communication with debug proxy processes
 */
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { fileURLToPath } from 'url';
import { createInitialState, handleProxyMessage, isValidProxyMessage } from '../dap-core/index.js';
import { ErrorMessages } from '../utils/error-messages.js';
/**
 * Concrete implementation of ProxyManager
 */
export class ProxyManager extends EventEmitter {
    adapter;
    proxyProcessLauncher;
    fileSystem;
    logger;
    proxyProcess = null;
    sessionId = null;
    currentThreadId = null;
    pendingDapRequests = new Map();
    isInitialized = false;
    isDryRun = false;
    adapterConfigured = false;
    dapState = null;
    stderrBuffer = [];
    constructor(adapter, // Optional adapter for language-agnostic support
    proxyProcessLauncher, fileSystem, logger) {
        super();
        this.adapter = adapter;
        this.proxyProcessLauncher = proxyProcessLauncher;
        this.fileSystem = fileSystem;
        this.logger = logger;
    }
    async start(config) {
        if (this.proxyProcess) {
            throw new Error('Proxy already running');
        }
        this.sessionId = config.sessionId;
        this.isDryRun = config.dryRunSpawn === true;
        // Initialize functional core state
        this.dapState = createInitialState(config.sessionId);
        // Use adapter to validate environment and resolve executable if available
        let executablePath = config.executablePath;
        if (this.adapter) {
            // Validate environment first
            const validation = await this.adapter.validateEnvironment();
            if (!validation.valid) {
                throw new Error(`Invalid environment for ${this.adapter.language}: ${validation.errors[0].message}`);
            }
            // Resolve executable path if not provided
            if (!executablePath) {
                executablePath = await this.adapter.resolveExecutablePath();
                this.logger.info(`[ProxyManager] Adapter resolved executable path: ${executablePath}`);
            }
        }
        else if (!executablePath) {
            throw new Error('No executable path provided and no adapter available to resolve it');
        }
        // Find proxy bootstrap script
        const proxyScriptPath = await this.findProxyScript();
        // Use environment as-is without any path manipulation
        // Filter out undefined values to satisfy TypeScript
        const env = {};
        for (const [key, value] of Object.entries(process.env)) {
            if (value !== undefined) {
                env[key] = value;
            }
        }
        this.logger.info(`[ProxyManager] Spawning proxy for session ${config.sessionId}. Path: ${proxyScriptPath}`);
        try {
            this.proxyProcess = this.proxyProcessLauncher.launchProxy(proxyScriptPath, config.sessionId, env);
        }
        catch (error) {
            this.logger.error(`[ProxyManager] Failed to spawn proxy:`, error);
            throw error;
        }
        if (!this.proxyProcess || typeof this.proxyProcess.pid === 'undefined') {
            throw new Error('Proxy process is invalid or PID is missing');
        }
        this.logger.info(`[ProxyManager] Proxy spawned with PID: ${this.proxyProcess.pid}`);
        // Set up event handlers
        this.setupEventHandlers();
        // Wait for proxy to be ready before sending init command
        await new Promise((resolve, reject) => {
            const readyTimeout = setTimeout(() => {
                reject(new Error('Proxy did not send ready signal within 5 seconds'));
            }, 5000);
            const handleProxyReady = (message) => {
                const msg = message;
                if (msg?.type === 'proxy-ready') {
                    clearTimeout(readyTimeout);
                    this.proxyProcess?.removeListener('message', handleProxyReady);
                    this.logger.info('[ProxyManager] Proxy is ready to receive commands');
                    resolve();
                }
            };
            this.proxyProcess?.on('message', handleProxyReady);
        });
        // Send initialization command
        const initCommand = {
            cmd: 'init',
            sessionId: config.sessionId,
            executablePath: executablePath, // Using resolved executable path
            adapterHost: config.adapterHost,
            adapterPort: config.adapterPort,
            logDir: config.logDir,
            scriptPath: config.scriptPath,
            scriptArgs: config.scriptArgs,
            stopOnEntry: config.stopOnEntry,
            justMyCode: config.justMyCode,
            initialBreakpoints: config.initialBreakpoints,
            dryRunSpawn: config.dryRunSpawn,
            // Pass adapter command info for language-agnostic adapter spawning
            adapterCommand: config.adapterCommand
        };
        // Debug log the command being sent
        this.logger.info(`[ProxyManager] Sending init command with adapterCommand:`, {
            hasAdapterCommand: !!config.adapterCommand,
            adapterCommand: config.adapterCommand ? {
                command: config.adapterCommand.command,
                args: config.adapterCommand.args,
                hasEnv: !!config.adapterCommand.env
            } : null
        });
        this.sendCommand(initCommand);
        // Wait for initialization or dry run completion
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error(ErrorMessages.proxyInitTimeout(30)));
            }, 30000);
            const cleanup = () => {
                clearTimeout(timeout);
                this.removeListener('initialized', handleInitialized);
                this.removeListener('dry-run-complete', handleDryRun);
                this.removeListener('error', handleError);
                this.removeListener('exit', handleExit);
            };
            const handleInitialized = () => {
                this.isInitialized = true;
                cleanup();
                resolve();
            };
            const handleDryRun = () => {
                cleanup();
                resolve();
            };
            const handleError = (error) => {
                cleanup();
                reject(error);
            };
            const handleExit = (code, signal) => {
                cleanup();
                if (this.isDryRun && code === 0) {
                    // Normal exit for dry run
                    resolve();
                }
                else {
                    let errorMessage = `Proxy exited during initialization. Code: ${code}, Signal: ${signal}`;
                    if (this.stderrBuffer.length > 0) {
                        errorMessage += `\nStderr output:\n${this.stderrBuffer.join('\n')}`;
                    }
                    reject(new Error(errorMessage));
                }
            };
            this.once('initialized', handleInitialized);
            this.once('dry-run-complete', handleDryRun);
            this.once('error', handleError);
            this.once('exit', handleExit);
        });
    }
    async stop() {
        if (!this.proxyProcess) {
            return;
        }
        this.logger.info(`[ProxyManager] Stopping proxy for session ${this.sessionId}`);
        // Mark as shutting down to stop processing new messages
        const process = this.proxyProcess;
        // Immediately cleanup to prevent "unknown request" warnings
        this.cleanup();
        // Send terminate command if process is still running
        try {
            if (!process.killed) {
                process.send({ cmd: 'terminate', sessionId: this.sessionId });
            }
        }
        catch (error) {
            this.logger.error(`[ProxyManager] Error sending terminate command:`, error);
        }
        // Wait for graceful exit or force kill after timeout
        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                this.logger.warn(`[ProxyManager] Timeout waiting for proxy exit. Force killing.`);
                if (!process.killed) {
                    process.kill('SIGKILL');
                }
                resolve();
            }, 5000);
            process.once('exit', () => {
                clearTimeout(timeout);
                resolve();
            });
            // If already killed/exited, resolve immediately
            if (process.killed || process.exitCode !== null) {
                clearTimeout(timeout);
                resolve();
            }
        });
    }
    async sendDapRequest(command, args) {
        if (!this.proxyProcess || !this.isInitialized) {
            throw new Error('Proxy not initialized');
        }
        const requestId = uuidv4();
        const commandToSend = {
            cmd: 'dap',
            sessionId: this.sessionId,
            requestId,
            dapCommand: command,
            dapArgs: args
        };
        this.logger.info(`[ProxyManager] Sending DAP command: ${command}, requestId: ${requestId}`);
        return new Promise((resolve, reject) => {
            this.pendingDapRequests.set(requestId, {
                resolve: resolve,
                reject,
                command
            });
            try {
                this.sendCommand(commandToSend);
            }
            catch (error) {
                this.pendingDapRequests.delete(requestId);
                reject(error);
            }
            // Timeout handler
            setTimeout(() => {
                if (this.pendingDapRequests.has(requestId)) {
                    this.pendingDapRequests.delete(requestId);
                    reject(new Error(ErrorMessages.dapRequestTimeout(command, 35)));
                }
            }, 35000);
        });
    }
    isRunning() {
        return this.proxyProcess !== null && !this.proxyProcess.killed;
    }
    getCurrentThreadId() {
        return this.currentThreadId;
    }
    async findProxyScript() {
        // Check if we're running from a bundled environment
        const isBundled = fileURLToPath(import.meta.url).includes('bundle.cjs');
        let distPath;
        if (isBundled) {
            // In bundled environment (e.g., Docker container), proxy-bootstrap.js is in same dist directory
            distPath = path.resolve(process.cwd(), 'dist/proxy/proxy-bootstrap.js');
        }
        else {
            // In development/non-bundled environment, resolve relative to this module's location
            const moduleDir = path.dirname(fileURLToPath(import.meta.url));
            distPath = path.resolve(moduleDir, '../../dist/proxy/proxy-bootstrap.js');
        }
        this.logger.info(`[ProxyManager] Checking for proxy script at: ${distPath} (bundled: ${isBundled})`);
        if (!(await this.fileSystem.pathExists(distPath))) {
            const moduleDir = path.dirname(fileURLToPath(import.meta.url));
            throw new Error(`Bootstrap worker script not found at: ${distPath}\n` +
                `Module directory: ${moduleDir}\n` +
                `Current working directory: ${process.cwd()}\n` +
                `Is bundled: ${isBundled}\n` +
                `This usually means:\n` +
                `  1. You need to run 'npm run build' first\n` +
                `  2. The build failed to copy proxy files\n` +
                `  3. The TypeScript compilation structure is unexpected`);
        }
        return distPath;
    }
    sendCommand(command) {
        if (!this.proxyProcess || this.proxyProcess.killed) {
            throw new Error('Proxy process not available');
        }
        this.proxyProcess.sendCommand(command);
    }
    setupEventHandlers() {
        if (!this.proxyProcess)
            return;
        // Handle IPC messages
        this.proxyProcess.on('message', (rawMessage) => {
            this.handleProxyMessage(rawMessage);
        });
        // Handle stderr
        this.proxyProcess.stderr?.on('data', (data) => {
            const output = data.toString().trim();
            this.logger.error(`[ProxyManager STDERR] ${output}`);
            // Capture stderr for error reporting during initialization
            if (!this.isInitialized) {
                this.stderrBuffer.push(output);
            }
        });
        // Handle exit
        this.proxyProcess.on('exit', (code, signal) => {
            this.logger.info(`[ProxyManager] Proxy exited. Code: ${code}, Signal: ${signal}`);
            this.handleProxyExit(code, signal);
        });
        // Handle errors
        this.proxyProcess.on('error', (err) => {
            this.logger.error(`[ProxyManager] Proxy error:`, err);
            this.emit('error', err);
            this.cleanup();
        });
    }
    handleProxyMessage(rawMessage) {
        this.logger.debug(`[ProxyManager] Received message:`, rawMessage);
        // Validate message format
        if (!isValidProxyMessage(rawMessage)) {
            this.logger.warn(`[ProxyManager] Invalid message format:`, rawMessage);
            return;
        }
        const message = rawMessage;
        // Use functional core if state is initialized
        if (this.dapState) {
            const result = handleProxyMessage(this.dapState, message);
            // Execute commands from functional core
            for (const command of result.commands) {
                switch (command.type) {
                    case 'log':
                        this.logger[command.level](command.message, command.data);
                        break;
                    case 'emitEvent':
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Event args must support variable argument counts, any[] required for spread operator
                        this.emit(command.event, ...command.args);
                        break;
                    case 'killProcess':
                        this.proxyProcess?.kill();
                        break;
                    case 'sendToProxy':
                        this.sendCommand(command.command);
                        break;
                    // Note: sendToClient is not used in ProxyManager context
                }
            }
            // Update state if changed
            if (result.newState) {
                this.dapState = result.newState;
                // Sync local state with functional core state
                this.isInitialized = result.newState.initialized;
                this.adapterConfigured = result.newState.adapterConfigured;
                this.currentThreadId = result.newState.currentThreadId ?? null;
            }
            // Handle pending DAP responses (still done imperatively for now)
            if (message.type === 'dapResponse') {
                this.handleDapResponse(message);
            }
        }
        else {
            // Fallback if state not initialized (shouldn't happen)
            this.logger.error(`[ProxyManager] DAP state not initialized`);
        }
    }
    handleDapResponse(message) {
        const pending = this.pendingDapRequests.get(message.requestId);
        if (!pending) {
            // During shutdown, it's normal to receive responses for requests that were cancelled
            if (this.proxyProcess) {
                this.logger.debug(`[ProxyManager] Received response for unknown/cancelled request: ${message.requestId}`);
            }
            return;
        }
        this.pendingDapRequests.delete(message.requestId);
        if (message.success) {
            pending.resolve((message.response || message.body));
        }
        else {
            pending.reject(new Error(message.error || `DAP request '${pending.command}' failed`));
        }
    }
    handleDapEvent(message) {
        this.logger.info(`[ProxyManager] DAP event: ${message.event}`, message.body);
        switch (message.event) {
            case 'stopped':
                const stoppedBody = message.body;
                const threadId = stoppedBody?.threadId || 0;
                const reason = stoppedBody?.reason || 'unknown';
                if (threadId) {
                    this.currentThreadId = threadId;
                }
                this.emit('stopped', threadId, reason, stoppedBody);
                break;
            case 'continued':
                this.emit('continued');
                break;
            case 'terminated':
                this.emit('terminated');
                break;
            case 'exited':
                this.emit('exited');
                break;
            // Forward other events as generic DAP events
            default:
                this.emit('dap-event', message.event, message.body);
        }
    }
    handleStatusMessage(message) {
        switch (message.status) {
            case 'proxy_minimal_ran_ipc_test':
                this.logger.info(`[ProxyManager] IPC test message received`);
                this.proxyProcess?.kill();
                break;
            case 'dry_run_complete':
                this.logger.info(`[ProxyManager] Dry run complete`);
                this.emit('dry-run-complete', message.command, message.script);
                break;
            case 'adapter_configured_and_launched':
                this.logger.info(`[ProxyManager] Adapter configured and launched`);
                this.adapterConfigured = true;
                this.emit('adapter-configured');
                if (!this.isInitialized) {
                    this.isInitialized = true;
                    this.emit('initialized');
                }
                break;
            case 'adapter_exited':
            case 'dap_connection_closed':
            case 'terminated':
                this.logger.info(`[ProxyManager] Status: ${message.status}`);
                this.emit('exit', message.code || 1, message.signal || undefined);
                break;
        }
    }
    handleProxyExit(code, signal) {
        // Clean up pending requests
        this.pendingDapRequests.forEach(pending => {
            pending.reject(new Error('Proxy exited'));
        });
        this.pendingDapRequests.clear();
        // Emit exit event
        this.emit('exit', code, signal || undefined);
        // Clean up
        this.cleanup();
    }
    cleanup() {
        // Clear pending DAP requests to avoid "unknown request" warnings during shutdown
        if (this.pendingDapRequests.size > 0) {
            this.logger.debug(`[ProxyManager] Clearing ${this.pendingDapRequests.size} pending DAP requests during cleanup`);
            for (const pending of this.pendingDapRequests.values()) {
                pending.reject(new Error(`Request cancelled during proxy shutdown: ${pending.command}`));
            }
            this.pendingDapRequests.clear();
        }
        this.proxyProcess = null;
        this.isInitialized = false;
        this.adapterConfigured = false;
        this.currentThreadId = null;
    }
}
//# sourceMappingURL=proxy-manager.js.map