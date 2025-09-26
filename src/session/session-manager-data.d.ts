/**
 * Data retrieval operations for session management including variables,
 * stack traces, and scopes.
 */
import { Variable, StackFrame } from '@debugmcp/shared';
import { SessionManagerCore } from './session-manager-core.js';
import { DebugProtocol } from '@vscode/debugprotocol';
/**
 * Data retrieval functionality for session management
 */
export declare class SessionManagerData extends SessionManagerCore {
    getVariables(sessionId: string, variablesReference: number): Promise<Variable[]>;
    getStackTrace(sessionId: string, threadId?: number): Promise<StackFrame[]>;
    getScopes(sessionId: string, frameId: number): Promise<DebugProtocol.Scope[]>;
}
