/**
 * Data retrieval operations for session management including variables,
 * stack traces, and scopes.
 */
import { SessionState } from '@debugmcp/shared';
import { SessionManagerCore } from './session-manager-core.js';
/**
 * Data retrieval functionality for session management
 */
export class SessionManagerData extends SessionManagerCore {
    async getVariables(sessionId, variablesReference) {
        const session = this._getSessionById(sessionId);
        this.logger.info(`[SM getVariables ${sessionId}] Entered. variablesReference: ${variablesReference}, Current state: ${session.state}`);
        if (!session.proxyManager || !session.proxyManager.isRunning()) {
            this.logger.warn(`[SM getVariables ${sessionId}] No active proxy.`);
            return [];
        }
        if (session.state !== SessionState.PAUSED) {
            this.logger.warn(`[SM getVariables ${sessionId}] Session not paused. State: ${session.state}.`);
            return [];
        }
        try {
            this.logger.info(`[SM getVariables ${sessionId}] Sending DAP 'variables' for variablesReference ${variablesReference}.`);
            const response = await session.proxyManager.sendDapRequest('variables', { variablesReference });
            this.logger.info(`[SM getVariables ${sessionId}] DAP 'variables' response received. Body:`, response?.body);
            if (response && response.body && response.body.variables) {
                const vars = response.body.variables.map((v) => ({
                    name: v.name, value: v.value, type: v.type || "<unknown_type>",
                    variablesReference: v.variablesReference,
                    expandable: v.variablesReference > 0
                }));
                this.logger.info(`[SM getVariables ${sessionId}] Parsed variables:`, vars.map(v => ({ name: v.name, value: v.value, type: v.type })));
                return vars;
            }
            this.logger.warn(`[SM getVariables ${sessionId}] No variables in response body for reference ${variablesReference}. Response:`, response);
            return [];
        }
        catch (error) {
            this.logger.error(`[SM getVariables ${sessionId}] Error getting variables:`, error);
            return [];
        }
    }
    async getStackTrace(sessionId, threadId) {
        const session = this._getSessionById(sessionId);
        const currentThreadId = session.proxyManager?.getCurrentThreadId();
        this.logger.info(`[SM getStackTrace ${sessionId}] Entered. Requested threadId: ${threadId}, Current state: ${session.state}, Actual currentThreadId: ${currentThreadId}`);
        if (!session.proxyManager || !session.proxyManager.isRunning()) {
            this.logger.warn(`[SM getStackTrace ${sessionId}] No active proxy.`);
            return [];
        }
        if (session.state !== SessionState.PAUSED) {
            this.logger.warn(`[SM getStackTrace ${sessionId}] Session not paused. State: ${session.state}.`);
            return [];
        }
        const currentThreadForRequest = threadId || currentThreadId;
        if (!currentThreadForRequest) {
            this.logger.warn(`[SM getStackTrace ${sessionId}] No effective thread ID to use.`);
            return [];
        }
        try {
            this.logger.info(`[SM getStackTrace ${sessionId}] Sending DAP 'stackTrace' for threadId ${currentThreadForRequest}.`);
            const response = await session.proxyManager.sendDapRequest('stackTrace', { threadId: currentThreadForRequest });
            this.logger.info(`[SM getStackTrace ${sessionId}] DAP 'stackTrace' response received. Body:`, response?.body);
            if (response && response.body && response.body.stackFrames) {
                const frames = response.body.stackFrames.map((sf) => ({
                    id: sf.id, name: sf.name,
                    file: sf.source?.path || sf.source?.name || "<unknown_source>",
                    line: sf.line, column: sf.column
                }));
                this.logger.info(`[SM getStackTrace ${sessionId}] Parsed stack frames (top 3):`, frames.slice(0, 3).map(f => ({ name: f.name, file: f.file, line: f.line })));
                return frames;
            }
            this.logger.warn(`[SM getStackTrace ${sessionId}] No stackFrames in response body. Response:`, response);
            return [];
        }
        catch (error) {
            this.logger.error(`[SM getStackTrace ${sessionId}] Error getting stack trace:`, error);
            return [];
        }
    }
    async getScopes(sessionId, frameId) {
        const session = this._getSessionById(sessionId);
        this.logger.info(`[SM getScopes ${sessionId}] Entered. frameId: ${frameId}, Current state: ${session.state}`);
        if (!session.proxyManager || !session.proxyManager.isRunning()) {
            this.logger.warn(`[SM getScopes ${sessionId}] No active proxy.`);
            return [];
        }
        if (session.state !== SessionState.PAUSED) {
            this.logger.warn(`[SM getScopes ${sessionId}] Session not paused. State: ${session.state}.`);
            return [];
        }
        try {
            this.logger.info(`[SM getScopes ${sessionId}] Sending DAP 'scopes' for frameId ${frameId}.`);
            const response = await session.proxyManager.sendDapRequest('scopes', { frameId });
            this.logger.info(`[SM getScopes ${sessionId}] DAP 'scopes' response received. Body:`, response?.body);
            if (response && response.body && response.body.scopes) {
                this.logger.info(`[SM getScopes ${sessionId}] Parsed scopes:`, response.body.scopes.map(s => ({ name: s.name, ref: s.variablesReference, expensive: s.expensive })));
                return response.body.scopes;
            }
            this.logger.warn(`[GetScopes] No scopes in response body for session ${sessionId}, frameId ${frameId}. Response:`, response);
            return [];
        }
        catch (error) {
            this.logger.error(`[SM getScopes ${sessionId}] Error getting scopes:`, error);
            return [];
        }
    }
}
//# sourceMappingURL=session-manager-data.js.map