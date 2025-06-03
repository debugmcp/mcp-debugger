// Global error handlers for the proxy worker process
process.on('uncaughtException', (err: Error, origin: string) => { 
    (loggerInstance || console).error(`[Proxy Worker UNCAUGHT_EXCEPTION] Origin: ${origin}`, err);
    sendToParent({ type: 'error', message: `Proxy worker uncaught exception: ${err.message} (origin: ${origin})`, sessionId: currentSessionId || 'unknown' });
    shutdown().finally(() => process.exit(1));
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
process.on('unhandledRejection', (reason: any, promise: Promise<unknown>) => { 
    (loggerInstance || console).error('[Proxy Worker UNHANDLED_REJECTION] Reason:', reason, 'Promise:', promise);
    sendToParent({ type: 'error', message: `Proxy worker unhandled rejection: ${String(reason)}`, sessionId: currentSessionId || 'unknown' });
    shutdown().finally(() => process.exit(1));
});

// Original content of dap-proxy.ts follows:
import { spawn, ChildProcess } from 'child_process';
import fs from 'fs-extra';
import { DebugProtocol } from '@vscode/debugprotocol';
import path from 'path';
import readline from 'readline';
import { MinimalDapClient } from './minimal-dap.js';
import { createLogger as createProxyLogger } from '../utils/logger.js';

console.error('[Proxy Worker] Imports successful.');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let loggerInstance: any; 
let dapClient: MinimalDapClient | null = null;
let adapterProcess: ChildProcess | null = null;
let currentSessionId: string | null = null; 

interface ProxyInitPayload {
  cmd: 'init';
  sessionId: string;
  pythonPath: string;
  adapterHost: string;
  adapterPort: number;
  logDir: string;
  scriptPath: string;
  scriptArgs?: string[];
  stopOnEntry?: boolean;
  justMyCode?: boolean;
  initialBreakpoints?: { file: string; line: number; condition?: string }[];
  dryRunSpawn?: boolean;
}

interface DapCommandPayload {
  cmd: 'dap';
  requestId: string;
  dapCommand: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dapArgs?: any;
  sessionId: string; 
}

interface TerminatePayload {
  cmd: 'terminate';
  sessionId: string; 
}

type ParentCommand = ProxyInitPayload | DapCommandPayload | TerminatePayload;

let currentInitPayload: ProxyInitPayload | null = null; 

console.error('[Proxy Worker] Top-level script execution started.');
console.error(`[Proxy Worker] Current working directory: ${process.cwd()}`);
console.error('[Proxy Worker] Node.js version:', process.version);

async function processParentMessage(messageStr: string) {
    const effectiveLogger = loggerInstance || { error: console.error, info: console.error, debug: console.error, warn: console.error };
    effectiveLogger.error(`[Proxy Worker] processParentMessage received string (first 200 chars): ${messageStr.substring(0, 200)}...`);

    try {
        const command = JSON.parse(messageStr) as ParentCommand; 
        
        if (command.cmd !== 'init' && !loggerInstance) {
            console.error('[Proxy PRE_INIT_ERROR] Received non-init command before logger setup:', command);
            sendToParent({ type: 'error', message: 'Proxy not initialized. "init" command must be first.', sessionId: command.sessionId || currentSessionId || 'unknown' });
            process.exit(1); 
            return;
        }
        
        const logFn = loggerInstance ? loggerInstance.info.bind(loggerInstance) : console.error.bind(console);
        logFn(`[Proxy] Received command from parent: ${command.cmd}`, { command }); 
        await handleCommandFromParent(command);
    } catch (e: unknown) { 
        const errorMsg = e instanceof Error ? e.message : String(e);
        const errorDetails = { lineReceived: messageStr, error: errorMsg, stack: (e instanceof Error ? e.stack : undefined) };
        const errLogFn = loggerInstance ? loggerInstance.error.bind(loggerInstance) : console.error.bind(console);
        errLogFn('[Proxy] Error processing command from parent:', errorDetails);
        sendToParent({ type: 'error', message: `Proxy error processing command: ${errorMsg}`, sessionId: currentSessionId || 'unknown' });
    }
}

if (process.send) {
    console.error('[Proxy Worker] Main IPC channel (process.send) detected. Setting up primary "message" listener.');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    process.on('message', (message: any) => {
        console.error('[Proxy Worker Main Listener] IPC message event triggered.');
        if (typeof message === 'string') {
            processParentMessage(message);
        } else if (typeof message === 'object' && message !== null) {
            console.error('[Proxy Main IPC] Received object message, attempting to stringify/parse:', message);
            try {
                processParentMessage(JSON.stringify(message));
            } catch (e: unknown) { 
                const errLogFn = loggerInstance ? loggerInstance.error.bind(loggerInstance) : console.error.bind(console);
                errLogFn('[Proxy Main IPC] Could not process non-string message object:', { message, error: (e instanceof Error ? e.message : String(e)) });
            }
        } else {
            console.error('[Proxy Main IPC] Received message of unexpected type:', typeof message, message);
        }
    });
} else {
    console.error('[Proxy Worker] No main IPC channel (process.send is undefined). This script expects to be run as a child process with IPC.');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: false });
    console.error('[Proxy Worker] Setting up readline on stdin as fallback.');
    rl.on('line', (line: string) => processParentMessage(line));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sendToParent(message: any) {
    const logFn = loggerInstance ? loggerInstance.debug.bind(loggerInstance) : console.error.bind(console); 
    
    let finalSessionId: string;
    if (message && typeof message.sessionId === 'string' && message.sessionId.trim() !== '') {
        finalSessionId = message.sessionId;
    } else if (currentSessionId && typeof currentSessionId === 'string' && currentSessionId.trim() !== '') {
        finalSessionId = currentSessionId;
    } else {
        finalSessionId = 'proxy_session_id_unavailable';
    }

    const messageToSend = {
        ...message,
        sessionId: finalSessionId 
    };
    
    logFn('[Proxy Worker] Sending message to parent:', messageToSend);
    if (process.send) {
        process.send(messageToSend);
    } else {
        process.stdout.write(JSON.stringify(message) + '\n');
    }
}

async function handleCommandFromParent(command: ParentCommand) { 
    currentSessionId = command.sessionId; 

    switch (command.cmd) {
        case 'init':
            currentInitPayload = command; 
            const proxyLogPath = path.join(command.logDir, `proxy-${currentSessionId}.log`);
            try {
                await fs.ensureDir(path.dirname(proxyLogPath));
                loggerInstance = createProxyLogger(`dap-proxy:${currentSessionId}`, { level: 'debug', file: proxyLogPath });
                loggerInstance.info(`[Proxy INIT] DAP Proxy worker initialized for session ${currentSessionId}. Adapter logs in ${command.logDir}. Log file: ${proxyLogPath}`);
            } catch (logError: unknown) { 
                const message = logError instanceof Error ? logError.message : String(logError);
                console.error(`[Proxy CRITICAL_LOG_ERROR] Failed to create logger or ensure log directory ${proxyLogPath}:`, logError);
                sendToParent({ type: 'error', message: `Proxy critical logging error: ${message}`, sessionId: currentSessionId });
                process.exit(1);
                return;
            }
            await startDebugpyAdapterAndSequence(currentInitPayload);
            break;
        case 'dap':
            if (!dapClient) {
                loggerInstance.error('[Proxy DAP] DAP client not active for DAP command.');
                sendToParent({ type: 'dapResponse', requestId: command.requestId, success: false, error: 'DAP client not active', sessionId: currentSessionId });
                return;
            }
            try {
                if (command.dapCommand === 'setBreakpoints') {
                    loggerInstance.info(`[Proxy DAP] Received 'setBreakpoints' command. Args:`, command.dapArgs);
                }
                const response = await dapClient.sendRequest(command.dapCommand, command.dapArgs);
                if (command.dapCommand === 'setBreakpoints') {
                    loggerInstance.info(`[Proxy DAP] Response from adapter for 'setBreakpoints':`, response);
                }
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                sendToParent({ type: 'dapResponse', requestId: command.requestId, success: true, body: (response as any).body, response, sessionId: currentSessionId });
            } catch (e: unknown) { 
                const errorMsg = e instanceof Error ? e.message : String(e);
                if (command.dapCommand === 'setBreakpoints') {
                    loggerInstance.error(`[Proxy DAP] Error during 'setBreakpoints' command to adapter:`, { error: errorMsg, stack: (e instanceof Error ? e.stack : undefined) });
                }
                loggerInstance.error(`[Proxy] DAP command ${command.dapCommand} failed:`, { error: errorMsg });
                sendToParent({ type: 'dapResponse', requestId: command.requestId, success: false, error: errorMsg, sessionId: currentSessionId });
            }
            break;
        case 'terminate':
            loggerInstance.info('[Proxy] Received terminate command. Shutting down.');
            await shutdown();
            sendToParent({ type: 'status', status: 'terminated', sessionId: currentSessionId });
            process.exit(0);
            break;
        default:
            (loggerInstance || console).warn('[Proxy] Unknown command type received:', command);
            sendToParent({ type: 'error', message: `Unknown command type received by proxy.`, sessionId: currentSessionId });
    }
}

async function startDebugpyAdapterAndSequence(payload: ProxyInitPayload) { 
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { pythonPath, adapterHost, adapterPort, logDir: adapterLogDir, scriptPath, scriptArgs, stopOnEntry, justMyCode, initialBreakpoints, dryRunSpawn } = payload;
    
    const fullAdapterCommand = `${pythonPath} -m debugpy.adapter --host ${adapterHost} --port ${adapterPort} --log-dir "${adapterLogDir}"`;
    loggerInstance.info(`[Proxy] Proposed debugpy.adapter command: ${fullAdapterCommand}`);
    loggerInstance.info(`[Proxy] Using absolute scriptPath: ${scriptPath}`);

    if (dryRunSpawn) {
      loggerInstance.warn(`[Proxy DRY_RUN] Dry run enabled. Would execute: ${fullAdapterCommand}`);
      loggerInstance.warn(`[Proxy DRY_RUN] Script to debug: ${scriptPath}`);
      sendToParent({ type: 'status', status: 'dry_run_complete', command: fullAdapterCommand, script: scriptPath, sessionId: currentSessionId });
      loggerInstance.info('[Proxy DRY_RUN] Delaying exit for 100ms to ensure message delivery.');
      setTimeout(() => {
        loggerInstance.info('[Proxy DRY_RUN] Exiting now after delay.');
        process.exit(0); 
      }, 100);
      return; 
    }
    
    loggerInstance.info(`[Proxy] Spawning debugpy.adapter: ${fullAdapterCommand}`);
    await fs.ensureDir(adapterLogDir);

    if (!path.isAbsolute(scriptPath)) {
        loggerInstance.error(`[Proxy CRITICAL] Received scriptPath is not absolute: ${scriptPath}. This should have been resolved by SessionManager.`);
        sendToParent({ type: 'error', message: `Proxy critical error: scriptPath "${scriptPath}" is not absolute.`, sessionId: currentSessionId });
        await shutdown();
        return;
    }
    const scriptExists = await fs.pathExists(scriptPath);
    if (!scriptExists) {
        loggerInstance.error(`[Proxy CRITICAL] Absolute scriptPath does not exist: ${scriptPath}`);
        sendToParent({ type: 'error', message: `Proxy critical error: scriptPath "${scriptPath}" not found.`, sessionId: currentSessionId });
        await shutdown();
        return;
    }
    loggerInstance.debug(`[Proxy] Script path ${scriptPath} exists: yes (verified)`);
    loggerInstance.debug(`[Proxy] Script path is absolute: true (verified)`);
    
    loggerInstance.debug(`[Proxy] Adapter log dir: ${adapterLogDir}`);
    loggerInstance.debug(`[Proxy] Adapter log dir exists: ${await fs.pathExists(adapterLogDir)}`);
    
    const preferredCwd = process.env.MCP_SERVER_CWD && typeof process.env.MCP_SERVER_CWD === 'string' && process.env.MCP_SERVER_CWD.trim() !== ''
                         ? process.env.MCP_SERVER_CWD
                         : process.cwd();

    const adapterSpawnOptions = { 
        stdio: ['ignore', 'inherit', 'inherit', 'ipc'] as ('ignore' | 'pipe' | 'inherit' | 'ipc' | number)[], 
        cwd: preferredCwd, 
        env: { ...process.env },    
        detached: true 
    };

    loggerInstance.info('[Proxy] About to spawn debugpy.adapter with:');
    loggerInstance.info(`  execPath: ${pythonPath}`);
    const spawnArgsForAdapter = [
        '-m', 'debugpy.adapter', 
        '--host', adapterHost, 
        '--port', String(adapterPort),
        '--log-dir', adapterLogDir
    ];
    loggerInstance.info(`  args: ${JSON.stringify(spawnArgsForAdapter)}`);
    loggerInstance.info(`  cwd: ${adapterSpawnOptions.cwd}`);
    loggerInstance.info(`  env: ${Object.keys(adapterSpawnOptions.env).length} env vars`);
    
    try {
        await fs.ensureDir(adapterLogDir);
        loggerInstance.info(`[Proxy] Ensured adapter log directory exists: ${adapterLogDir}`);
    } catch (ensureDirError: unknown) { 
        const message = ensureDirError instanceof Error ? ensureDirError.message : String(ensureDirError);
        loggerInstance.error(`[Proxy CRITICAL] Failed to ensure adapter log directory ${adapterLogDir}:`, ensureDirError);
        sendToParent({ type: 'error', message: `Proxy critical error: Failed to create adapter log directory: ${message}`, sessionId: currentSessionId });
        await shutdown();
        return;
    }
    
    adapterProcess = spawn(pythonPath, spawnArgsForAdapter, adapterSpawnOptions);

    if (adapterProcess.pid) { 
        adapterProcess.unref(); 
        loggerInstance.info(`[Proxy] Called unref() on adapter process PID: ${adapterProcess.pid}`);
    }

    if (adapterProcess && adapterProcess.pid) {
        loggerInstance.info(`[Proxy] debugpy.adapter process spawned successfully with PID: ${adapterProcess.pid}`);
    } else {
        loggerInstance.error('[Proxy] Failed to spawn debugpy.adapter process or PID is undefined.', { adapterProcessObject: adapterProcess });
        sendToParent({ type: 'error', message: 'Proxy critical error: Failed to spawn adapter process or get PID.', sessionId: currentSessionId });
        await shutdown();
        return; 
    }

    adapterProcess.on('error', (err: Error) => { 
        loggerInstance.error('[Proxy][AdapterSpawnError] Adapter process spawn error:', err);
        sendToParent({ type: 'error', message: `Adapter process spawn error: ${err.message}`, sessionId: currentSessionId });
    });
    adapterProcess.on('exit', (code: number | null, signal: NodeJS.Signals | null) => { 
        loggerInstance.info(`[Proxy][AdapterExit] Adapter process exited. Code: ${code}, Signal: ${signal}`);
        sendToParent({ type: 'status', status: 'adapter_exited', code, signal, sessionId: currentSessionId });
    });

    dapClient = new MinimalDapClient(adapterHost, adapterPort);

    // Temporary error handler to prevent unhandled 'error' event crashes during connect attempts.
    // The actual connection error is handled by the promise rejection of dapClient.connect().
    const tempErrorHandler = (err: Error) => {
      loggerInstance.debug(`[Proxy] DAP client emitted 'error' during connection phase (expected for retries): ${err.message}`);
    };
    dapClient.on('error', tempErrorHandler);

    const INITIAL_CONNECT_DELAY = 500; 
    loggerInstance.info(`[Proxy] Waiting ${INITIAL_CONNECT_DELAY}ms before first DAP connect attempt.`);
    await new Promise(resolve => setTimeout(resolve, INITIAL_CONNECT_DELAY));

    const MAX_CONNECT_ATTEMPTS = 60; 
    const CONNECT_RETRY_INTERVAL = 200; 
    let connectAttempts = 0;

    while (true) {
        if (!dapClient) { 
            loggerInstance.error('[Proxy] DAP client became null during connect retry loop; aborting connection attempts.');
            sendToParent({ type: 'error', message: 'Proxy critical error: DAP client lost during connect retry.', sessionId: currentSessionId });
            return; 
        }
        try {
            loggerInstance.info(`[Proxy] Attempting DAP client connect (attempt ${connectAttempts + 1}/${MAX_CONNECT_ATTEMPTS}) to ${adapterHost}:${adapterPort}`);
            await dapClient.connect();
            loggerInstance.info('[Proxy] DAP client connected to adapter successfully.');
            
            dapClient.off('error', tempErrorHandler); // Remove temporary handler as connection succeeded
            // Set up event handlers now that connection is successful
            setupDapEventHandlers(dapClient);
            loggerInstance.info('[Proxy] DAP event handlers set up after successful connection.');

            break; 
        } catch (err: unknown) { 
            connectAttempts++;
            const errMessage = err instanceof Error ? err.message : String(err);
            if (connectAttempts >= MAX_CONNECT_ATTEMPTS) {
                loggerInstance.error(`[Proxy] Failed to connect DAP client after ${MAX_CONNECT_ATTEMPTS} attempts. Last error: ${errMessage}`);
                sendToParent({ type: 'error', message: `Failed to connect DAP client: ${errMessage}`, sessionId: currentSessionId });
                if (dapClient) { 
                    dapClient.off('error', tempErrorHandler); // Clean up temporary handler on final failure
                    await shutdown(); 
                }
                return;
            }
            loggerInstance.warn(`[Proxy] DAP client connect attempt ${connectAttempts} failed: ${errMessage}. Retrying in ${CONNECT_RETRY_INTERVAL}ms...`);
            await new Promise(resolve => setTimeout(resolve, CONNECT_RETRY_INTERVAL));
        }
    }

    try {
        const initializeArgs: DebugProtocol.InitializeRequestArguments = { 
            clientID: `mcp-proxy-${currentSessionId}`, clientName: 'MCP Debug Proxy', adapterID: 'python',
            pathFormat: 'path', linesStartAt1: true, columnsStartAt1: true,
            supportsVariableType: true, supportsRunInTerminalRequest: false, locale: 'en-US'
        };
        await (dapClient as MinimalDapClient).sendRequest('initialize', initializeArgs);
        loggerInstance.info('[Proxy] DAP "initialize" request sent and response received.');

        if (!currentInitPayload || !dapClient) { 
            loggerInstance.error('[Proxy CRITICAL] Pre-launch: currentInitPayload or dapClient is null.');
            sendToParent({ type: 'error', message: 'Proxy internal error: missing initPayload or dapClient before launch.', sessionId: currentSessionId });
            await shutdown();
            return; 
        }
        const { scriptPath: launchScriptPath, scriptArgs: launchScriptArgsUsed, stopOnEntry: launchStopOnEntryUsed, justMyCode: launchJustMyCodeUsed } = currentInitPayload!; 
        const launchArgs = { // Removed the eslint-disable from here as it will be on the type assertion line
            program: launchScriptPath, 
            stopOnEntry: launchStopOnEntryUsed !== undefined ? launchStopOnEntryUsed : true, 
            noDebug: false, 
            args: launchScriptArgsUsed || [],
            cwd: path.dirname(launchScriptPath), 
            console: "internalConsole", 
            justMyCode: launchJustMyCodeUsed !== undefined ? launchJustMyCodeUsed : true,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as DebugProtocol.LaunchRequestArguments & { program: string; [key: string]: any }; 
        loggerInstance.info('[Proxy] Sending "launch" request to adapter immediately after "initialize" with args:', launchArgs);
        await dapClient.sendRequest('launch', launchArgs); 
        loggerInstance.info('[Proxy] DAP "launch" request sent. Now waiting for "initialized" event from adapter.');

    } catch (e: unknown) { 
        const errorMsg = e instanceof Error ? e.message : String(e);
        loggerInstance.error('[Proxy] Error during DAP connect or initial initialize:', { error: errorMsg, stack: (e instanceof Error ? e.stack : undefined) });
        sendToParent({ type: 'error', message: `DAP connect/initialize error: ${errorMsg}`, sessionId: currentSessionId });
        await shutdown();
    }
}

function setupDapEventHandlers(client: MinimalDapClient) { 
    client.on('initialized', async () => { 
        loggerInstance.info('[Proxy] DAP event: "initialized" received. Adapter is ready for configuration.');
        if (!currentInitPayload || !dapClient) { 
            loggerInstance.error('[Proxy CRITICAL] "initialized" handler: currentInitPayload or dapClient is null.');
            sendToParent({ type: 'error', message: 'Proxy internal error: missing initPayload or dapClient in "initialized" handler.', sessionId: currentSessionId });
            await shutdown();
            return;
        }
        
        const { scriptPath, initialBreakpoints: initialBreakpointsUsed } = currentInitPayload;
        loggerInstance.info('[Proxy "initialized" handler] Proceeding with DAP sequence...');

        try {
            if (initialBreakpointsUsed && initialBreakpointsUsed.length > 0) {
                const bpsToSend: DebugProtocol.SourceBreakpoint[] = initialBreakpointsUsed.map(bp => ({ line: bp.line, condition: bp.condition }));
                const setBreakpointsArgs = { 
                    source: { path: scriptPath }, 
                    breakpoints: bpsToSend
                } as DebugProtocol.SetBreakpointsArguments;
                loggerInstance.info(`[Proxy "initialized" handler] Sending ${bpsToSend.length} initial breakpoint(s) for ${scriptPath}. Args:`, setBreakpointsArgs);
                const bpResponse = await dapClient.sendRequest('setBreakpoints', setBreakpointsArgs);
                loggerInstance.info('[Proxy "initialized" handler] Initial breakpoints sent. Response from adapter:', bpResponse);
            } else {
                loggerInstance.info('[Proxy "initialized" handler] No initial breakpoints to send.');
            }

            loggerInstance.info('[Proxy "initialized" handler] Sending "configurationDone" to adapter.');
            await dapClient.sendRequest('configurationDone', {});
            loggerInstance.info('[Proxy "initialized" handler] "configurationDone" sent.');
            
            loggerInstance.info('[Proxy "initialized" handler] DAP sequence (post-launch) complete. Sending "adapter_configured_and_launched" to parent.');
            sendToParent({ type: 'status', status: 'adapter_configured_and_launched', sessionId: currentSessionId });
        } catch (e: unknown) {
            const errorMsg = e instanceof Error ? e.message : String(e);
            loggerInstance.error('[Proxy "initialized" handler] Error during post-initialize DAP sequence:', { error: errorMsg, stack: (e instanceof Error ? e.stack : undefined) });
            sendToParent({ type: 'error', message: `Error in DAP sequence after "initialized": ${errorMsg}`, sessionId: currentSessionId });
            await shutdown();
        }
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    client.on('output', (body: any) => {
        loggerInstance.debug('[Proxy] DAP event: output', body);
        sendToParent({ type: 'dapEvent', event: 'output', body, sessionId: currentSessionId });
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    client.on('stopped', (body: any) => { 
        loggerInstance.info('[Proxy] DAP event: stopped', body);
        sendToParent({ type: 'dapEvent', event: 'stopped', body, sessionId: currentSessionId });
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    client.on('continued', (body: any) => { 
        loggerInstance.info('[Proxy] DAP event: continued', body);
        sendToParent({ type: 'dapEvent', event: 'continued', body, sessionId: currentSessionId });
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    client.on('thread', (body: any) => { 
        loggerInstance.debug('[Proxy] DAP event: thread', body);
        sendToParent({ type: 'dapEvent', event: 'thread', body, sessionId: currentSessionId });
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    client.on('exited', (body: any) => { 
        loggerInstance.info('[Proxy] DAP event: exited (debuggee)', body);
        sendToParent({ type: 'dapEvent', event: 'exited', body, sessionId: currentSessionId });
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    client.on('terminated', (body: any) => { 
        loggerInstance.info('[Proxy] DAP event: terminated (session)', body);
        sendToParent({ type: 'dapEvent', event: 'terminated', body, sessionId: currentSessionId });
        shutdown(); 
    });
    client.on('error', (err: Error) => { 
        loggerInstance.error('[Proxy] DAP client reported an error:', err);
        sendToParent({ type: 'error', message: `DAP client error: ${err.message}`, sessionId: currentSessionId });
    });
    client.on('close', () => { 
        loggerInstance.info('[Proxy] DAP client connection closed.');
        sendToParent({ type: 'status', status: 'dap_connection_closed', sessionId: currentSessionId });
        shutdown(); 
    });
}

let shuttingDown = false;
async function shutdown() {
    const effectiveLogger = loggerInstance || { 
        info: console.log.bind(console), 
        warn: console.error.bind(console), 
        error: console.error.bind(console) 
    };

    if (shuttingDown) {
        effectiveLogger.info('[Proxy] Shutdown already in progress. Returning.');
        return;
    }
    shuttingDown = true;
    effectiveLogger.info('[Proxy] Initiating shutdown sequence...');

    // Capture local references to resources that will be cleaned up.
    const clientToShutdown = dapClient;
    const processToKill = adapterProcess;

    // Nullify global references early to prevent new operations on them.
    dapClient = null;
    adapterProcess = null;

    // 1. Disconnect DAP Client
    if (clientToShutdown) {
        effectiveLogger.info('[Proxy] DAP client instance found. Attempting graceful disconnect.');
        try {
            effectiveLogger.info('[Proxy] Sending "disconnect" request to DAP adapter...');
            await Promise.race([
                clientToShutdown.sendRequest('disconnect', { terminateDebuggee: true }),
                new Promise((_, reject) => setTimeout(() => reject(new Error('DAP disconnect request timed out after 1000ms')), 1000))
            ]);
            effectiveLogger.info('[Proxy] DAP "disconnect" request successfully sent or timed out gracefully.');
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : String(e);
            effectiveLogger.warn(`[Proxy] Error or timeout during DAP "disconnect" request: ${message}`);
        }
        
        // Always call the client's disconnect method to clean up its internal state (socket, listeners).
        try {
            effectiveLogger.info('[Proxy] Calling MinimalDapClient.disconnect() for final cleanup.');
            clientToShutdown.disconnect(); // This is now idempotent and robust.
            effectiveLogger.info('[Proxy] MinimalDapClient.disconnect() called.');
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : String(e);
            effectiveLogger.error(`[Proxy] Error calling MinimalDapClient.disconnect(): ${message}`, e);
        }
    } else {
        effectiveLogger.info('[Proxy] No active DAP client instance to disconnect.');
    }

    // 2. Terminate Adapter Process
    if (processToKill && processToKill.pid) {
        effectiveLogger.info(`[Proxy] Adapter process (PID: ${processToKill.pid}) found. Attempting termination.`);
        try {
            if (!processToKill.killed) {
                effectiveLogger.info(`[Proxy] Sending SIGTERM to adapter process PID: ${processToKill.pid}.`);
                processToKill.kill('SIGTERM');
                
                // Wait a short period for graceful exit
                await new Promise(resolve => setTimeout(resolve, 300));

                if (!processToKill.killed) {
                    effectiveLogger.warn(`[Proxy] Adapter process PID: ${processToKill.pid} did not exit after SIGTERM and 300ms. Sending SIGKILL.`);
                    processToKill.kill('SIGKILL');
                } else {
                    effectiveLogger.info(`[Proxy] Adapter process PID: ${processToKill.pid} exited after SIGTERM.`);
                }
            } else {
                 effectiveLogger.info(`[Proxy] Adapter process PID: ${processToKill.pid} was already marked as killed.`);
            }
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : String(e);
            effectiveLogger.error(`[Proxy] Error during adapter process termination (PID: ${processToKill.pid}): ${message}`, e);
        }
    } else {
        effectiveLogger.info('[Proxy] No active adapter process to terminate.');
    }

    effectiveLogger.info('[Proxy] Shutdown sequence completed.');
    // Note: process.exit() is handled by the callers of shutdown() if needed (e.g., on terminate command or unhandled errors).
}

// Global error handlers for the proxy worker process
// These were moved to the top of the file in the user's provided content,
// but the original `dap-proxy.ts` had them at the bottom.
// For this diff, we assume they are at the bottom as per the original structure before this change.
// If they are indeed at the top, this SEARCH block will fail.
// The user's provided content for dap-proxy.ts shows them at the top AND bottom.
// This diff targets the ones at the bottom.

process.on('uncaughtException', (err: Error, origin: string) => { 
    (loggerInstance || console).error(`[Proxy Worker UNCAUGHT_EXCEPTION] Origin: ${origin}`, err);
    sendToParent({ type: 'error', message: `Proxy worker uncaught exception: ${err.message} (origin: ${origin})`, sessionId: currentSessionId || 'unknown' });
    shutdown().finally(() => process.exit(1));
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
process.on('unhandledRejection', (reason: any, promise: Promise<unknown>) => { 
    (loggerInstance || console).error('[Proxy Worker UNHANDLED_REJECTION] Reason:', reason, 'Promise:', promise);
    sendToParent({ type: 'error', message: `Proxy worker unhandled rejection: ${String(reason)}`, sessionId: currentSessionId || 'unknown' });
    shutdown().finally(() => process.exit(1));
});

process.on('SIGINT', async () => {
    (loggerInstance || console).info('[Proxy] SIGINT received, shutting down proxy worker.');
    await shutdown();
    process.exit(0);
});
process.on('SIGTERM', async () => {
    (loggerInstance || console).info('[Proxy] SIGTERM received, shutting down proxy worker.');
    await shutdown();
    process.exit(0);
});

if (!process.send) {
    console.error('[Proxy Worker] No IPC channel. This script expects to be run as a child process with an IPC channel.');
} else {
    console.error('[Proxy Worker] IPC channel detected. Waiting for init command from parent.');
}
