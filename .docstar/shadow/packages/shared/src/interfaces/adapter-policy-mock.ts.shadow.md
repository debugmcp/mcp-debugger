# packages/shared/src/interfaces/adapter-policy-mock.ts
@source-hash: 2ab2e45dfe8fb394
@generated: 2026-02-09T18:14:10Z

**Purpose**: Mock implementation of AdapterPolicy interface for testing debug adapter functionality without real debugger interactions.

**Core Structure**:
- `MockAdapterPolicy` (L11-214): Complete AdapterPolicy implementation with simplified, testing-oriented behaviors
- Named 'mock' adapter type with minimal configuration requirements

**Key Method Categories**:

**Session Management** (L13-21):
- `supportsReverseStartDebugging`: false - no reverse debugging support
- `childSessionStrategy`: 'none' - no child session handling
- `buildChildStartArgs`: throws error - child sessions not supported
- `isChildReadyEvent`: checks for 'initialized' event

**Stack Frame & Variable Handling** (L26-67):
- `filterStackFrames`: pass-through implementation returning all frames unfiltered
- `extractLocalVariables`: simple extraction from top frame's first scope
- `getLocalScopeName`: returns basic scope names ['Local', 'Locals']

**Configuration Methods** (L69-88):
- `getDapAdapterConfiguration`: returns type 'mock'
- `resolveExecutablePath`: returns 'mock' placeholder or provided path
- `getDebuggerConfiguration`: minimal config with strict handshake disabled

**Command Processing** (L93-105):
- `requiresCommandQueueing`: always false - immediate processing
- `shouldQueueCommand`: returns no queueing/deferring behavior

**State Management** (L110-148):
- `createInitialState`: creates state with initialized/configurationDone flags
- `updateStateOnCommand`: tracks 'configurationDone' command
- `updateStateOnEvent`: tracks 'initialized' event
- `isInitialized`/`isConnected`: both check initialized flag

**Adapter Identification** (L153-160):
- `matchesAdapter`: detects 'mock-adapter' in command or arguments

**Client Behavior Configuration** (L172-192):
- `getDapClientBehavior`: returns minimal DapClientBehavior with most features disabled
- Short timeout (1000ms) for testing efficiency

**Spawn Configuration** (L197-213):
- `getAdapterSpawnConfig`: returns custom adapter command if provided, otherwise undefined for mock usage

**Dependencies**:
- `@vscode/debugprotocol` for Debug Adapter Protocol types
- Local interfaces: AdapterPolicy, StackFrame, Variable, DapClientBehavior
- Implements complete AdapterPolicy contract for testing scenarios

**Key Design Patterns**:
- Simplified implementations that prioritize testing over functionality
- Pass-through or no-op behaviors where complex logic isn't needed for tests
- State tracking focused on basic initialization lifecycle
- Error throwing for unsupported operations (child sessions)