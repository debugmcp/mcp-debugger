# src/session/session-manager-data.ts
@source-hash: 5b425fa6b13cd1b0
@generated: 2026-02-09T18:15:11Z

## SessionManagerData

Data retrieval layer for debug session management. Extends SessionManagerCore to provide operations for fetching variables, stack traces, and scopes via Debug Adapter Protocol (DAP).

### Core Purpose
- Bridge between session management and debug adapter data retrieval
- Apply language-specific policies for stack frame filtering and variable extraction
- Handle DAP communication through proxy managers

### Key Components

#### SessionManagerData Class (L24-266)
Primary class providing data access methods with built-in validation and error handling.

**selectPolicy(language)** (L28-48)
- Maps language strings/enums to appropriate AdapterPolicy implementations
- Supports: Python, JavaScript, Rust, Go, Mock, with DefaultAdapterPolicy fallback
- Returns policy objects for language-specific behavior customization

**getVariables(sessionId, variablesReference)** (L50-83)
- Fetches variables for a given reference ID via DAP 'variables' request
- Validates session state (must be PAUSED) and proxy availability
- Maps DAP Variable responses to internal Variable format with expandable flag
- Returns empty array on errors/invalid states

**getStackTrace(sessionId, threadId?, includeInternals)** (L85-134)
- Retrieves stack frames via DAP 'stackTrace' request
- Uses current thread ID if threadId not provided
- Applies language-specific filtering through AdapterPolicy.filterStackFrames
- Maps DAP StackFrame to internal StackFrame format

**getScopes(sessionId, frameId)** (L136-164)
- Fetches scopes for specific stack frame via DAP 'scopes' request
- Returns raw DebugProtocol.Scope array
- Used as input for variable retrieval

**getLocalVariables(sessionId, includeSpecial)** (L172-265)
- High-level orchestration method combining stack trace, scopes, and variables
- Collects data from all frames and scopes into maps
- Delegates to AdapterPolicy.extractLocalVariables for language-specific local variable identification
- Returns structured result with variables, frame context, and scope name
- Fallback behavior: first non-global scope from top frame

### Dependencies
- SessionManagerCore (base class)
- @debugmcp/shared types (Variable, StackFrame, SessionState, AdapterPolicy variants)
- @vscode/debugprotocol for DAP types
- Session proxy managers for DAP communication

### Error Handling Pattern
All methods follow consistent validation:
1. Check proxy manager existence and running state
2. Verify session is in PAUSED state
3. Wrap DAP requests in try-catch with logging
4. Return empty arrays/null objects on failures

### Architectural Notes
- Language-agnostic design with policy-based customization
- Extensive logging with session ID prefixes for debugging
- Defensive programming with multiple validation layers
- Maps between DAP protocol types and internal representations