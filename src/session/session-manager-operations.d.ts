import { Breakpoint } from '@debugmcp/shared';
import { ManagedSession } from './session-store.js';
import { DebugProtocol } from '@vscode/debugprotocol';
import { SessionManagerData } from './session-manager-data.js';
import { CustomLaunchRequestArguments, DebugResult } from './session-manager-core.js';
/**
 * Result type for evaluate expression operations
 */
export interface EvaluateResult {
    success: boolean;
    result?: string;
    type?: string;
    variablesReference?: number;
    namedVariables?: number;
    indexedVariables?: number;
    presentationHint?: DebugProtocol.VariablePresentationHint;
    error?: string;
}
/**
 * Debug operations functionality for session management
 */
export declare class SessionManagerOperations extends SessionManagerData {
    protected startProxyManager(session: ManagedSession, scriptPath: string, scriptArgs?: string[], dapLaunchArgs?: Partial<CustomLaunchRequestArguments>, dryRunSpawn?: boolean): Promise<void>;
    /**
     * Helper method to wait for dry run completion with timeout
     */
    private waitForDryRunCompletion;
    startDebugging(sessionId: string, scriptPath: string, scriptArgs?: string[], dapLaunchArgs?: Partial<CustomLaunchRequestArguments>, dryRunSpawn?: boolean): Promise<DebugResult>;
    setBreakpoint(sessionId: string, file: string, line: number, condition?: string): Promise<Breakpoint>;
    stepOver(sessionId: string): Promise<DebugResult>;
    stepInto(sessionId: string): Promise<DebugResult>;
    stepOut(sessionId: string): Promise<DebugResult>;
    continue(sessionId: string): Promise<DebugResult>;
    /**
     * Validate that a Python command is a real Python executable, not a Windows Store alias.
     * Mirrors the validation approach used in the python adapter utilities.
     */
    private isValidPythonExecutable;
    /**
     * Helper method to truncate long strings for logging
     */
    private truncateForLog;
    /**
     * Evaluate an expression in the context of the current debug session.
     * The debugger must be paused for evaluation to work.
     * Expressions CAN and SHOULD be able to modify program state (this is a feature).
     *
     * @param sessionId - The session ID
     * @param expression - The expression to evaluate
     * @param frameId - Optional stack frame ID for context (defaults to current frame)
     * @param context - The context in which to evaluate ('repl' is default for maximum flexibility)
     * @returns Evaluation result with value, type, and optional variable reference
     */
    evaluateExpression(sessionId: string, expression: string, frameId?: number, context?: 'watch' | 'repl' | 'hover' | 'clipboard' | 'variables'): Promise<EvaluateResult>;
}
