# MCP Debugger Logging Format Specification

## Overview

This document defines the structured logging format used by mcp-debugger for visualization purposes. Main server structured logs are written to `logs/debug-mcp-server.log` in JSON format for easy parsing by the Terminal UI visualizer. The default log path is derived from the module location (`<module-dir>/../../logs/debug-mcp-server.log` via `import.meta.url`); if that resolution fails (e.g., in test environments), the fallback is `process.cwd()/logs/debug-mcp-server.log`. In container mode (`MCP_CONTAINER=true`), the path is overridden to `/app/logs/debug-mcp-server.log`. Note: other log files may exist alongside this file (e.g., proxy process logs, rotated log files with numeric suffixes) — only `debug-mcp-server.log` follows this structured JSON specification.

## Log Entry Types

### 1. Tool Call Logs

#### tool:call
Logged when an MCP tool is invoked.

```json
{
  "timestamp": "2025-01-06T16:15:00.123Z",
  "level": "info",
  "namespace": "debug-mcp:tools",
  "message": "tool:call",
  "tool": "set_breakpoint",
  "sessionId": "abc-123-def-456",
  "sessionName": "My Debug Session",
  "request": {
    "file": "path/to/file.py",
    "line": 42,
    "condition": "x > 10"
  },
}
```

#### tool:response
Logged when a tool completes successfully.

```json
{
  "timestamp": "2025-01-06T16:15:00.456Z",
  "level": "info",
  "namespace": "debug-mcp:tools",
  "message": "tool:response",
  "tool": "set_breakpoint",
  "sessionId": "abc-123-def-456",
  "sessionName": "My Debug Session",
  "success": true,
  "response": {
    "breakpointId": "bp-1",
    "verified": true,
    "file": "path/to/file.py",
    "line": 42
  },
}
```

#### tool:error
Logged when a tool encounters an error.

```json
{
  "timestamp": "2025-01-06T16:15:00.789Z",
  "level": "error",
  "namespace": "debug-mcp:tools",
  "message": "tool:error",
  "tool": "start_debugging",
  "sessionId": "abc-123-def-456",
  "sessionName": "My Debug Session",
  "error": "Failed to connect to debugger",
}
```

### 2. Debug State Logs

#### debug:state
Logged when the debugger state changes (paused, running, stopped).

```json
{
  "timestamp": "2025-01-06T16:15:01.123Z",
  "level": "info",
  "namespace": "debug-mcp:state",
  "message": "debug:state",
  "event": "paused",
  "sessionId": "abc-123-def-456",
  "sessionName": "My Debug Session",
  "reason": "breakpoint",
  "location": {
    "file": "/workspace/src/main.py",
    "line": 42,
    "function": "process_data"
  },
  "threadId": 1,
}
```

State events include:
- `paused` - Execution stopped (reasons: breakpoint, step, entry, exception)
- `running` - Execution continuing
- `stopped` - Debug session terminated

### 3. Breakpoint Logs

#### debug:breakpoint
Logged for breakpoint lifecycle events.

```json
{
  "timestamp": "2025-01-06T16:15:02.123Z",
  "level": "info",
  "namespace": "debug-mcp:breakpoint",
  "message": "debug:breakpoint",
  "event": "verified",
  "sessionId": "abc-123-def-456",
  "sessionName": "My Debug Session",
  "breakpointId": "bp-1",
  "file": "/workspace/src/main.py",
  "line": 42,
  "verified": true,
}
```

Breakpoint events include:
- `set` - Breakpoint requested
- `verified` - Breakpoint confirmed by debugger
- `hit` - Breakpoint triggered execution pause

### 4. Session Lifecycle Logs

#### session:created
Logged when a new debug session is created.

```json
{
  "timestamp": "2025-01-06T16:14:50.123Z",
  "level": "info",
  "namespace": "debug-mcp:session",
  "message": "session:created",
  "sessionId": "abc-123-def-456",
  "sessionName": "My Debug Session",
  "language": "python",
  "executablePath": "/usr/bin/python3",
}
```

#### session:closed
Logged when a debug session is terminated.

```json
{
  "timestamp": "2025-01-06T16:20:00.123Z",
  "level": "info",
  "namespace": "debug-mcp:session",
  "message": "session:closed",
  "sessionId": "abc-123-def-456",
  "sessionName": "My Debug Session",
  "duration": 310000,
}
```

### 5. Debug Output Logs

#### debug:output
Logged to capture stdout/stderr from the debugged program.

```json
{
  "timestamp": "2025-01-06T16:15:04.123Z",
  "level": "info",
  "namespace": "debug-mcp:output",
  "message": "debug:output",
  "sessionId": "abc-123-def-456",
  "sessionName": "My Debug Session",
  "category": "stdout",
  "output": "Processing item 42...\n",
}
```

## Field Definitions

### Common Fields
- `timestamp` (ISO 8601 string): Human-readable timestamp for display (e.g. `"2025-01-06T16:15:00.123Z"`)
- `level`: Log level (info, debug, error, warn)
- `namespace`: Logger namespace for categorization
- `message`: Log type identifier for parsing
- `sessionId`: Unique session identifier (UUID)
- `sessionName`: Human-readable session name

> **Note:** Earlier versions of this spec showed a second `timestamp` field (Unix milliseconds) alongside the ISO 8601 string. In practice the JSON entries contain a single `timestamp` field in ISO 8601 format. Use `Date.parse()` or equivalent for sorting.

### Tool-specific Fields
- `tool`: Name of the MCP tool
- `request`: Tool input parameters (sanitized)
- `response`: Tool output data
- `error`: Error message string

### Debug-specific Fields
- `event`: Type of debug event
- `reason`: Reason for state change
- `location`: Current execution location
- `threadId`: Debug thread identifier
- `breakpointId`: Unique breakpoint identifier
- `frameId`: Stack frame identifier
- `variablesReference`: DAP variable reference number
- `variables`: Array of variable details

## Data Truncation Rules

Truncation is applied in targeted locations rather than as a generic deep traversal:

1. **Variable values in `get_variables` logging**: Individual variable `value` strings are truncated at 200 characters, and only the first 10 variables are included in the log entry.

2. **Request/Response objects**: Targeted sanitization via `sanitizePayloadForLogging`:
   - `adapterCommand.env` is sanitized by `sanitizeEnvForLogging`, which checks each key against a list of sensitive patterns (e.g., `api_key`, `secret`, `token`, `password`, `credential`, `auth`, `session_id`, `access_key`, `signing`, `private_key`). Matching keys have their values replaced with `[REDACTED]`; non-matching keys are passed through unchanged
   - Other request/response fields are not generically scrubbed; sanitization is intentionally targeted

There is no generic array truncation (e.g., "show first 5 items") applied across all log entries.

## Parsing Guidelines for TUI

1. **Filtering**: Use the `message` field to filter log types
   ```javascript
   const toolCalls = logs.filter(log => log.message === 'tool:call');
   const stateChanges = logs.filter(log => log.message === 'debug:state');
   ```

2. **Chronological Ordering**: Use the ISO 8601 `timestamp` string for ordering
   ```javascript
   logs.sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
   ```

3. **Session Grouping**: Group logs by `sessionId` for multi-session support
   ```javascript
   const sessionLogs = logs.reduce((acc, log) => {
     if (!acc[log.sessionId]) acc[log.sessionId] = [];
     acc[log.sessionId].push(log);
     return acc;
   }, {});
   ```

4. **Event Correlation**: Match tool calls with responses
   ```javascript
   const pendingCalls = new Map();
   logs.forEach(log => {
     if (log.message === 'tool:call') {
       pendingCalls.set(`${log.sessionId}-${log.tool}`, log);
     } else if (log.message === 'tool:response') {
       const call = pendingCalls.get(`${log.sessionId}-${log.tool}`);
       // Correlate call and response
     }
   });
   ```

## Performance Considerations

1. **Log Levels**: 
   - Use `info` for user-facing events (tool calls, state changes)
   - Use `debug` for detailed internal data
   - Configure logger to appropriate level for production vs development

2. **Batching**: Consider buffering logs for high-frequency events

3. **File Rotation**: File rotation is already implemented: 50MB per file, 3 rotated files maximum (150MB total). The newest logs are always in the base filename (`tailable: true`).

## Security Considerations

1. **No Secrets**: Never log passwords, API keys, or tokens
2. **Path Awareness**: Host mode requires absolute paths for file-based operations; relative paths are rejected by SimpleFileChecker. Logged paths reflect whatever the caller provided.
3. **PII Protection**: Avoid logging personally identifiable information
4. **Input Validation**: Sanitize user inputs before logging

## Example Usage in Code

Note: The `timestamp` field in log output is auto-generated by Winston in ISO 8601 format. Do not pass a manual `timestamp` in the metadata object.

```typescript
// Tool call logging
logger.info('tool:call', {
  tool: toolName,
  sessionId: args.sessionId,
  sessionName: session?.name,
  request: sanitizeRequest(args),
});

// State change logging
logger.info('debug:state', {
  event: 'paused',
  sessionId: sessionId,
  sessionName: session.name,
  reason: stopReason,
  location: {
    file: source.path,
    line: frame.line,
    function: frame.name
  },
  threadId: threadId,
});
```

## Version History

- **v1.0.0** (2025-01-06): Initial specification for TUI visualization support
