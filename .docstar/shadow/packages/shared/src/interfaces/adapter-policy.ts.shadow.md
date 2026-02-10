# packages/shared/src/interfaces/adapter-policy.ts
@source-hash: 0c494de196cf1616
@generated: 2026-02-09T18:14:21Z

## AdapterPolicy Interface for DAP Multi-Session Management

This file defines the core adapter policy contracts that enable adapter-specific behaviors in the Debug Adapter Protocol (DAP) transport layer while keeping the core generic.

### Primary Purpose
Provides a typed policy interface to handle adapter-specific quirks, multi-session strategies, and command queueing behaviors across different language debuggers (js-debug, debugpy, etc.).

### Key Types & Interfaces

**ChildSessionStrategy** (L21-25): Enum defining child session creation strategies:
- `none`: No child session support
- `launchWithPendingTarget`: Launch using __pendingTargetId (js-debug pattern)
- `attachByPort`: Attach via inspector port
- `adoptInParent`: Adopt pending target in same session

**CommandHandling** (L30-34): Result type for command processing decisions with `shouldQueue`, `shouldDefer` flags and optional reason.

**AdapterSpecificState** (L39-43): Extensible state object tracking `initialized`, `configurationDone` and custom adapter properties.

**AdapterPolicy** (L45-317): Core interface defining adapter behavior with key methods:

#### Multi-Session Management
- `supportsReverseStartDebugging` (L54): Boolean flag for reverse startDebugging support
- `childSessionStrategy` (L59): Strategy selection for child session creation
- `shouldDeferParentConfigDone()` (L66): Whether to delay parent configurationDone
- `buildChildStartArgs()` (L72-75): Constructs child session launch/attach arguments
- `isChildReadyEvent()` (L82): Determines when child session is ready for queries

#### Language-Specific Features  
- `filterStackFrames()` (L92): Optional stack frame filtering for internal/framework code
- `isInternalFrame()` (L101): Identifies internal/framework stack frames
- `extractLocalVariables()` (L113-118): Language-specific local variable extraction
- `getLocalScopeName()` (L126): Scope names containing local variables
- `resolveExecutablePath()` (L146): Language-specific executable resolution
- `validateExecutable()` (L177): Async executable validation

#### Command Queueing & State Management
- `requiresCommandQueueing()` (L200): Whether adapter needs command queueing
- `shouldQueueCommand()` (L208): Per-command queueing decisions
- `processQueuedCommands()` (L216-219): Queue processing and ordering
- `createInitialState()` (L225): Initial adapter state factory
- `updateStateOnCommand/Response/Event()` (L233-249): State mutation hooks
- `isInitialized()` (L256): Readiness check for command acceptance

#### Adapter Configuration
- `getDapAdapterConfiguration()` (L134-137): DAP adapter type configuration
- `getDebuggerConfiguration()` (L154-159): Debugger behavior flags
- `getInitializationBehavior()` (L277-286): Initialization quirks configuration
- `getDapClientBehavior()` (L293): DAP client behavior settings
- `getAdapterSpawnConfig()` (L301-316): Process spawning configuration

#### Runtime Integration
- `performHandshake()` (L186-194): Language-specific initialization sequence
- `isSessionReady()` (L165-168): Post-launch readiness determination
- `matchesAdapter()` (L270): Adapter command matching

### Default Implementation

**DefaultAdapterPolicy** (L325-356): Minimal placeholder implementation used during adapter determination phase. Implements safe defaults and throws errors for unsupported operations like child session creation.

### Dependencies
- `@vscode/debugprotocol`: DAP event types
- `../models/index.js`: StackFrame, Variable models
- `./dap-client-behavior.js`: Client behavior configuration
- `@debugmcp/shared`: SessionState type
- `./debug-adapter.js`: Launch configuration types

### Architectural Patterns
- **Policy Pattern**: Encapsulates adapter-specific behaviors behind unified interface
- **State Machine**: Manages adapter lifecycle through state transitions
- **Command Queue**: Handles DAP command ordering for sensitive adapters
- **Multi-Session Support**: Enables parent-child debugging relationships

This interface serves as the contract between generic DAP transport and language-specific adapter implementations, enabling robust multi-session debugging across different language ecosystems.