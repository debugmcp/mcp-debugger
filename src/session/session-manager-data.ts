/**
 * Data retrieval operations for session management including variables,
 * stack traces, and scopes.
 */
import { 
  Variable, 
  StackFrame, 
  SessionState,
  AdapterPolicy,
  DefaultAdapterPolicy,
  PythonAdapterPolicy,
  JsDebugAdapterPolicy,
  RustAdapterPolicy,
  MockAdapterPolicy,
  DebugLanguage
} from '@debugmcp/shared';
import { SessionManagerCore } from './session-manager-core.js';
import { DebugProtocol } from '@vscode/debugprotocol';

/**
 * Data retrieval functionality for session management
 */
export class SessionManagerData extends SessionManagerCore {
  /**
   * Selects the appropriate adapter policy based on language
   */
  protected selectPolicy(language: string | DebugLanguage): AdapterPolicy {
    switch (language) {
      case 'python':
      case DebugLanguage.PYTHON:
        return PythonAdapterPolicy;
      case 'javascript':
      case DebugLanguage.JAVASCRIPT:
        return JsDebugAdapterPolicy;
      case 'rust':
      case DebugLanguage.RUST:
        return RustAdapterPolicy;
      case 'mock':
      case DebugLanguage.MOCK:
        return MockAdapterPolicy;
      default:
        return DefaultAdapterPolicy;
    }
  }

  async getVariables(sessionId: string, variablesReference: number): Promise<Variable[]> {
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
      const response = await session.proxyManager.sendDapRequest<DebugProtocol.VariablesResponse>('variables', { variablesReference });
      this.logger.info(`[SM getVariables ${sessionId}] DAP 'variables' response received. Body:`, response?.body);

      if (response && response.body && response.body.variables) {
        const vars = response.body.variables.map((v: DebugProtocol.Variable) => ({ 
            name: v.name, value: v.value, type: v.type || "<unknown_type>", 
            variablesReference: v.variablesReference,
            expandable: v.variablesReference > 0 
        }));
        this.logger.info(`[SM getVariables ${sessionId}] Parsed variables:`, vars.map(v => ({name: v.name, value: v.value, type: v.type}))); 
        return vars;
      }
      this.logger.warn(`[SM getVariables ${sessionId}] No variables in response body for reference ${variablesReference}. Response:`, response);
      return [];
    } catch (error) {
      this.logger.error(`[SM getVariables ${sessionId}] Error getting variables:`, error);
      return [];
    }
  }

  async getStackTrace(sessionId: string, threadId?: number, includeInternals: boolean = false): Promise<StackFrame[]> {
    const session = this._getSessionById(sessionId);
    const currentThreadId = session.proxyManager?.getCurrentThreadId();
    this.logger.info(`[SM getStackTrace ${sessionId}] Entered. Requested threadId: ${threadId}, Current state: ${session.state}, Actual currentThreadId: ${currentThreadId}, includeInternals: ${includeInternals}`);
    
    if (!session.proxyManager || !session.proxyManager.isRunning()) { 
      this.logger.warn(`[SM getStackTrace ${sessionId}] No active proxy.`); 
      return []; 
    }
    if (session.state !== SessionState.PAUSED) { 
      this.logger.warn(`[SM getStackTrace ${sessionId}] Session not paused. State: ${session.state}.`); 
      return []; 
    }
    
    const currentThreadForRequest = threadId || currentThreadId;
    if (typeof currentThreadForRequest !== 'number') { 
      this.logger.warn(`[SM getStackTrace ${sessionId}] No effective thread ID to use.`); 
      return []; 
    }

    try {
      this.logger.info(`[SM getStackTrace ${sessionId}] Sending DAP 'stackTrace' for threadId ${currentThreadForRequest}.`);
      const response = await session.proxyManager.sendDapRequest<DebugProtocol.StackTraceResponse>('stackTrace', { threadId: currentThreadForRequest });
      this.logger.info(`[SM getStackTrace ${sessionId}] DAP 'stackTrace' response received. Body:`, response?.body);
      
      if (response && response.body && response.body.stackFrames) {
        let frames: StackFrame[] = response.body.stackFrames.map((sf: DebugProtocol.StackFrame) => ({ 
            id: sf.id, name: sf.name, 
            file: sf.source?.path || sf.source?.name || "<unknown_source>", 
            line: sf.line, column: sf.column
        }));
        
        // Apply filtering using the language's policy
        const policy = this.selectPolicy(session.language);
        if (policy.filterStackFrames) {
          this.logger.info(`[SM getStackTrace ${sessionId}] Applying stack frame filtering for ${session.language}. Original count: ${frames.length}`);
          frames = policy.filterStackFrames(frames, includeInternals);
          this.logger.info(`[SM getStackTrace ${sessionId}] After filtering: ${frames.length} frames`);
        }
        
        this.logger.info(`[SM getStackTrace ${sessionId}] Parsed stack frames (top 3):`, frames.slice(0,3).map(f => ({name:f.name, file:f.file, line:f.line})));
        return frames;
      }
      this.logger.warn(`[SM getStackTrace ${sessionId}] No stackFrames in response body. Response:`, response);
      return [];
    } catch (error) {
      this.logger.error(`[SM getStackTrace ${sessionId}] Error getting stack trace:`, error);
      return [];
    }
  }

  async getScopes(sessionId: string, frameId: number): Promise<DebugProtocol.Scope[]> {
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
      const response = await session.proxyManager.sendDapRequest<DebugProtocol.ScopesResponse>('scopes', { frameId });
      this.logger.info(`[SM getScopes ${sessionId}] DAP 'scopes' response received. Body:`, response?.body);
      
      if (response && response.body && response.body.scopes) {
        this.logger.info(`[SM getScopes ${sessionId}] Parsed scopes:`, response.body.scopes.map(s => ({name: s.name, ref: s.variablesReference, expensive: s.expensive })));
        return response.body.scopes;
      }
      this.logger.warn(`[SM getScopes ${sessionId}] No scopes in response body for frameId ${frameId}. Response:`, response);
      return [];
    } catch (error) {
      this.logger.error(`[SM getScopes ${sessionId}] Error getting scopes:`, error);
      return [];
    }
  }

  /**
   * Get local variables for the current or specified stack frame.
   * This is a convenience method that orchestrates getting stack trace,
   * scopes, and variables, then delegates to the adapter policy to extract
   * just the local variables.
   */
  async getLocalVariables(sessionId: string, includeSpecial: boolean = false): Promise<{
    variables: Variable[];
    frame: { name: string; file: string; line: number } | null;
    scopeName: string | null;
  }> {
    const session = this._getSessionById(sessionId);
    this.logger.info(`[SM getLocalVariables ${sessionId}] Entered. includeSpecial: ${includeSpecial}, Current state: ${session.state}`);
    
    // Validate session state
    if (!session.proxyManager || !session.proxyManager.isRunning()) { 
      this.logger.warn(`[SM getLocalVariables ${sessionId}] No active proxy.`); 
      return { variables: [], frame: null, scopeName: null }; 
    }
    if (session.state !== SessionState.PAUSED) { 
      this.logger.warn(`[SM getLocalVariables ${sessionId}] Session not paused. State: ${session.state}.`); 
      return { variables: [], frame: null, scopeName: null }; 
    }
    
    try {
      // Step 1: Get stack trace
      const stackFrames = await this.getStackTrace(sessionId);
      if (!stackFrames || stackFrames.length === 0) {
        this.logger.warn(`[SM getLocalVariables ${sessionId}] No stack frames available.`);
        return { variables: [], frame: null, scopeName: null };
      }
      
      const topFrame = stackFrames[0];
      this.logger.info(`[SM getLocalVariables ${sessionId}] Top frame: ${topFrame.name} at ${topFrame.file}:${topFrame.line}`);
      
      // Step 2: Collect all scopes for all frames (may need multiple frames for closures)
      const scopesMap: Record<number, DebugProtocol.Scope[]> = {};
      for (const frame of stackFrames) {
        const scopes = await this.getScopes(sessionId, frame.id);
        if (scopes && scopes.length > 0) {
          scopesMap[frame.id] = scopes;
        }
      }
      
      // Step 3: Collect variables for all scopes
      const variablesMap: Record<number, Variable[]> = {};
      for (const frameId in scopesMap) {
        const scopes = scopesMap[frameId];
        for (const scope of scopes) {
          if (scope.variablesReference > 0) {
            const variables = await this.getVariables(sessionId, scope.variablesReference);
            if (variables && variables.length > 0) {
              variablesMap[scope.variablesReference] = variables;
            }
          }
        }
      }
      
      // Step 4: Get the appropriate adapter policy
      const policy = this.selectPolicy(session.language);
      
      // Step 5: Extract local variables using the adapter policy
      let localVars: Variable[] = [];
      let scopeName: string | null = null;
      
      if (policy.extractLocalVariables) {
        localVars = policy.extractLocalVariables(stackFrames, scopesMap, variablesMap, includeSpecial);
        
        // Get the scope name for reporting
        if (policy.getLocalScopeName) {
          const scopeNames = policy.getLocalScopeName();
          scopeName = Array.isArray(scopeNames) ? scopeNames[0] : scopeNames;
        }
      } else {
        // Fallback: use first non-global scope from top frame
        const topFrameScopes = scopesMap[topFrame.id] || [];
        const localScope = topFrameScopes.find(s => !s.name.toLowerCase().includes('global'));
        if (localScope) {
          localVars = variablesMap[localScope.variablesReference] || [];
          scopeName = localScope.name;
        }
      }
      
      this.logger.info(`[SM getLocalVariables ${sessionId}] Found ${localVars.length} local variables.`);
      
      return {
        variables: localVars,
        frame: {
          name: topFrame.name,
          file: topFrame.file,
          line: topFrame.line
        },
        scopeName
      };
      
    } catch (error) {
      this.logger.error(`[SM getLocalVariables ${sessionId}] Error getting local variables:`, error);
      return { variables: [], frame: null, scopeName: null };
    }
  }
}
