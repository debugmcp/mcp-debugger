# Stack Trace Filtering

## Overview
The MCP Debugger Server now supports language-specific stack trace filtering to improve debugging UX by hiding internal/framework frames by default.

## Features
- **JavaScript/Node.js**: Filters out `<node_internals>` frames by default
- **Go**: Filters out `/runtime/` and `/testing/` frames by default
- **Python**: No filtering applied (shows all frames)
- **Configurable**: Use `includeInternals: true` to see all frames

## Usage

### Default Behavior (Filtered)
When calling `get_stack_trace` without parameters or with `includeInternals: false`:

```json
{
  "tool": "get_stack_trace",
  "arguments": {
    "sessionId": "your-session-id"
  }
}
```

For JavaScript, this will return only user code frames, filtering out Node.js internals like:
- `<node_internals>/internal/modules/...`
- `<node_internals>/internal/process/...`
- etc.

### Including Internal Frames
To see all frames including internals:

```json
{
  "tool": "get_stack_trace",
  "arguments": {
    "sessionId": "your-session-id",
    "includeInternals": true
  }
}
```

## Implementation Details

### Architecture
The filtering is implemented using the existing `AdapterPolicy` system:

1. **AdapterPolicy Interface** (`packages/shared/src/interfaces/adapter-policy.ts`)
   - Added optional methods: `filterStackFrames()` and `isInternalFrame()`
   - Language adapters can implement these to define their filtering logic

2. **JsDebugAdapterPolicy** (`packages/shared/src/interfaces/adapter-policy-js.ts`)
   - Implements filtering for JavaScript
   - Identifies internal frames by checking for `<node_internals>` in the file path
   - Always keeps at least one frame if all are filtered

3. **GoAdapterPolicy** (`packages/shared/src/interfaces/adapter-policy-go.ts`)
   - Implements filtering for Go
   - Identifies internal frames by checking for `/runtime/` and `/testing/` in the file path
   - Always keeps at least one frame if all are filtered

4. **SessionManagerData** (`src/session/session-manager-data.ts`)
   - Applies filtering based on session language via `selectPolicy()`
   - Any language whose AdapterPolicy implements `filterStackFrames` will have filtering applied (currently JavaScript and Go)

### Edge Cases Handled
- **All frames internal**: At least the first frame is retained
- **No frames**: Returns empty array as before
- **Python/Other languages**: No filtering applied (only languages whose AdapterPolicy implements `filterStackFrames` are filtered)

## Benefits
1. **Cleaner Stack Traces**: Users see their code immediately, not framework internals
2. **Backward Compatible**: Existing code continues to work (defaults to filtered)
3. **Language-Specific**: Each language adapter can define its own filtering rules
4. **User Control**: Can still access full traces when needed

## Example Output

### Before (Unfiltered)
```json
{
  "stackFrames": [
    { "name": "main", "file": "test.js", "line": 10 },
    { "name": "Module._compile", "file": "<node_internals>/internal/modules/cjs/loader", "line": 1108 },
    { "name": "Module._extensions..js", "file": "<node_internals>/internal/modules/cjs/loader", "line": 1137 },
    { "name": "Module.load", "file": "<node_internals>/internal/modules/cjs/loader", "line": 975 },
    // ... 10+ more internal frames
  ]
}
```

### After (Filtered by Default)
```json
{
  "stackFrames": [
    { "name": "main", "file": "test.js", "line": 10 }
  ]
}
```

## Testing
The implementation has been verified with the JavaScript smoke tests which all pass:
- Stack trace retrieval works correctly
- Filtering is applied by default
- Other debugging features remain unaffected
