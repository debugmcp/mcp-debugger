# Stack Trace Filtering

## Overview
`get_stack_trace` applies language-specific stack trace filtering, hiding internal/framework frames by default so the caller sees user code first.

## Features
- **JavaScript/Node.js**: Filters out `<node_internals>`/`node:` frames, any frame under a `node_modules` path segment (pnpm's nested layout and Windows separators included), and js-debug's sourceless async separators (`await`, `Promise.then`, `bound-anonymous-fn` at line 0) by default (issue #655)
- **Go**: Filters out `/runtime/` and `/testing/` frames by default
- **Java**: Filters out JDK internal frames by default
- **.NET/C#**: Filters out `System.*` and `Microsoft.*` runtime frames and sourceless frames by default
- **Ruby**: Filters out `<internal:>` and `/gems/` frames by default
- **Rust** and **C/C++**: Share one CodeLLDB filter (`filterLldbStackFrames` in `packages/shared/src/interfaces/lldb-policy-shared.ts`) — LLDB-synthesized unnamed symbols (`___lldb_unnamed_symbol…`), glibc `__GI_` aliases, and libc/runtime plumbing and syscall wrappers *that also lack user source* (issue #369)
- **Python**: No filtering applied (shows all frames) — the only adapter policy that does not implement `filterStackFrames`
- **Mock**: Implements the hook as a pass-through; every frame is returned
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

For JavaScript, this will return only user code frames, filtering out:
- Node.js internals: `<node_internals>/internal/modules/...`, `<node_internals>/internal/process/...`
- Dependencies: `/app/node_modules/express/lib/router/index.js`, `/app/node_modules/.pnpm/router@2.2.0/node_modules/router/lib/layer.js`
- Async separators: `await` / `Promise.then` frames with no source and `line: 0`

The match is on a `node_modules` path *segment*, so `/app/src/node_modules_helper.js` is user code, and workspace packages (which Node realpaths to their `packages/...` location) stay visible. A debuggee that is itself an installed package (`/usr/lib/node_modules/<pkg>/...`) becomes all-internal — the top frame is kept and the `note` says so (see Edge Cases).

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

### Inspecting a specific thread
`threadId` (ids from `list_threads`) inspects that exact thread. An explicitly
requested thread is authoritative and is never silently switched for a sibling —
filtering still applies to whatever frames it reports.

```json
{
  "tool": "get_stack_trace",
  "arguments": {
    "sessionId": "your-session-id",
    "threadId": 2
  }
}
```

### What the response says about hidden frames
Whenever filtering removed anything, the response carries the count in
`hiddenFrames` and an explanation in `note`:

```json
{
  "success": true,
  "stackFrames": [ { "name": "main", "file": "test.js", "line": 10 } ],
  "count": 1,
  "includeInternals": false,
  "hiddenFrames": 12,
  "note": "12 internal frame(s) hidden — pass includeInternals: true to see them."
}
```

`note` is a single field shared with the resolver's other disclosures (a thread
switch, a frameless thread), so it may carry more than the hidden-frame sentence.

## Implementation Details

### Architecture
The filtering is implemented using the existing `AdapterPolicy` system:

1. **AdapterPolicy Interface** (`packages/shared/src/interfaces/adapter-policy.ts`)
   - Optional methods: `filterStackFrames()` and `isInternalFrame()`
   - Language adapters can implement these to define their filtering logic

2. **JsDebugAdapterPolicy** (`packages/shared/src/interfaces/adapter-policy-js.ts`)
   - Implements filtering for JavaScript
   - Identifies internal frames by path: `<node_internals>`/`node:`, any `node_modules` segment, and sourceless line-0 async separators (issue #655); `frame.name` never participates
   - No local fallback — the central `FrameAnchorResolver` guarantee below owns the all-internal case

3. **GoAdapterPolicy** (`packages/shared/src/interfaces/adapter-policy-go.ts`)
   - Implements filtering for Go
   - Identifies internal frames by checking for `/runtime/` and `/testing/` in the file path

4. **Shared LLDB policy** (`packages/shared/src/interfaces/lldb-policy-shared.ts`)
   - `filterLldbStackFrames` / `isLldbInternalFrame`, composed by both
     `adapter-policy-rust.ts` and `adapter-policy-cpp.ts` — the rule is
     engine-level, not language-level, so neither policy copies it
   - Pure-name rules (unnamed symbols, `__GI_` aliases) always hide; name+source
     rules (libc plumbing, syscall wrappers like `poll`/`accept`/`nanosleep`)
     hide only when the frame has no user source, so a user function that happens
     to share one of those names is kept

5. **FrameAnchorResolver** (`src/session/inspection/frame-anchor-resolver.ts`)
   - Applies filtering based on session language via `selectPolicy()` (defined in
     `src/session/session-manager-data.ts`, which reaches the resolver through
     `getStackTrace` / `getStackTraceDetailed`)
   - Any language whose AdapterPolicy implements `filterStackFrames` has filtering applied
   - Computes `totalFrameCount`, `hiddenFrameCount`, and `allFramesInternal`

6. **get_stack_trace handler** (`src/server/handlers/inspection-tools.ts`)
   - Turns that metadata into the `hiddenFrames` field and the `note` sentence

### Edge Cases Handled
- **All frames internal**: The filtered stack is never empty when the adapter reported frames. `FrameAnchorResolver` keeps the top (unfiltered) frame and sets `allFramesInternal`, so `get_scopes` and `evaluate_expression` always have a valid `frameId`; the `note` says so and points at `includeInternals: true` (issue #346). This guarantee is central and applies to every language, Go and .NET included. One policy additionally softens the result itself — Java returns the full unfiltered array (so a thread parked deep in JDK code still shows its stack)
- **No frames**: Returns empty array as before
- **Unresolvable source-mapped frames** (issue #655): when the adapter reports a frame's source as not-a-file-on-this-host (DAP `sourceReference != 0` with a real-looking path — js-debug does this for a source map's `../src/x.ts` that the package never shipped), the frame carries `unresolvedSource: true` and the `note` says its `file` is a label, not an openable path. These frames are the debuggee's own code and are never hidden. On js attach this is rare now: `resolveSourceMapLocations` excludes `node_modules` by default (so dependency maps are not applied and those frames report their real `.js` path) and `cwd` is defaulted so the debuggee's own relative map sources resolve
- **Python**: No filtering applied (Python's AdapterPolicy does not implement `filterStackFrames`)
- **Other languages**: Any language whose AdapterPolicy implements `filterStackFrames` has filtering applied

## Benefits
1. **Cleaner Stack Traces**: Users see their code immediately, not framework internals
2. **Backward Compatible**: Existing code continues to work (defaults to filtered)
3. **Language-Specific**: Each language adapter can define its own filtering rules
4. **User Control**: Can still access full traces when needed, and the response says when frames were hidden

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

## Related
- [`get_stack_trace` in the tool reference](./tool-reference.md#get_stack_trace) — full response shape, thread-anchoring contract, and `diagnostics`
