# packages/shared/src/interfaces/adapter-policy-js.ts
@source-hash: c89e631271a9703f
@generated: 2026-02-09T18:14:23Z

## JavaScript Debug Adapter Policy (js-debug/pwa-node)

**Primary Purpose:** Implements adapter-specific policy for VS Code's js-debug (pwa-node) debugger, handling JavaScript/TypeScript debugging with multi-session support and complex initialization sequences.

### Core Components

**JsAdapterState Interface (L16-20):** Extends base adapter state with JavaScript-specific flags:
- `initializeResponded`: Tracks initialize response reception
- `startSent`: Monitors launch/attach command execution
- `pendingCommands`: Queues commands during initialization

**Main Policy Object (L22-727):** `JsDebugAdapterPolicy` implements comprehensive adapter behavior:

### Key Capabilities

**Multi-Session Support (L24-42):**
- Enables reverse `startDebugging` requests for child process debugging
- Uses `launchWithPendingTarget` strategy for spawning child sessions
- Configures child sessions with `__pendingTargetId` for proper targeting

**Stack Frame Management (L48-72):**
- `isInternalFrame()`: Identifies Node.js internal frames by `<node_internals>` pattern
- `filterStackFrames()`: Removes internal frames while preserving at least one frame

**Variable Extraction (L77-150):**
- `extractLocalVariables()`: Extracts variables from local/script scopes
- Handles various scope names: Local, Locals, Script, Module, Block
- Filters out special variables (`this`, `__proto__`, V8 internals, debugger variables)

**Command Queueing System (L441-524):**
- `requiresCommandQueueing()`: Always returns true for strict ordering
- `shouldQueueCommand()`: Gates commands until proper initialization state
- `processQueuedCommands()`: Enforces JavaScript-specific command order

### Complex Handshake Sequence (L192-436)

**Strict Initialization Flow:**
1. Send `initialize` with `supportsStartDebuggingRequest: true`
2. Wait for `initialized` event (with 10s timeout)
3. Configure breakpoints and exception handling
4. Send `configurationDone`
5. Launch/attach with comprehensive configuration

**Launch Configuration (L344-431):**
- Auto-configures program path, working directory, runtime executable
- Handles sourcemap settings, output capture, smart stepping
- Uses `process.execPath` for consistent Node.js runtime

### State Management (L529-590)

**Lifecycle Tracking:**
- `createInitialState()`: Initializes JavaScript-specific state
- `updateStateOnCommand/Response/Event()`: Maintains initialization state
- `isInitialized()`: Requires both `initialized` event and response

### DAP Client Behavior (L623-704)

**Reverse Request Handling:**
- Processes `startDebugging` for child session creation
- Manages `__pendingTargetId` adoption tracking
- Handles `runInTerminal` requests

**Child Session Routing:** Defines 23 commands that route to child sessions including debugging controls, stack inspection, and variable manipulation.

### Integration Points

**Dependencies:**
- `@vscode/debugprotocol` for DAP types
- Base adapter policy interfaces
- SessionState from shared package
- Path utilities for dynamic imports

**Adapter Detection (L595-606):** Matches commands containing js-debug, pwa-node, or vsDebugServer patterns.

**Spawn Configuration (L709-727):** Delegates to provided adapter command since js-debug requires specific setup rather than simple executable launching.

### Critical Behaviors

- **Strict Command Ordering:** Enforces initialize → configuration → launch sequence
- **Multi-Session Architecture:** Handles parent-child debugging relationships
- **Breakpoint Mirroring:** Synchronizes breakpoints across sessions
- **Node.js Integration:** Optimized for Node.js runtime characteristics
- **Source Map Support:** Comprehensive TypeScript/source map handling