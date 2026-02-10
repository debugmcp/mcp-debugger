# src/proxy/child-session-manager.ts
@source-hash: be3a89035593d014
@generated: 2026-02-09T18:15:18Z

## Primary Purpose

Manages child debug sessions for multi-session debug adapters, specifically designed for JavaScript debugging scenarios where the main debugger spawns multiple concurrent sessions (like js-debug/pwa-node).

## Key Components

### Core Class: ChildSessionManager (L68-496)
Extends EventEmitter to provide event-driven child session lifecycle management. Handles creation, configuration, and cleanup of child DAP sessions with sophisticated state tracking.

**Key Properties:**
- `policy: AdapterPolicy` - Controls child session behavior and capabilities
- `dapBehavior: DapClientBehavior` - Extracted behavior configuration from policy
- `activeChild: MinimalDapClient | null` - Current primary child session
- `childSessions: Map<string, MinimalDapClient>` - All managed child sessions by pendingId
- `adoptedTargets: Set<string>` - Prevents duplicate adoption of pending targets
- `storedBreakpoints: Map<string, DebugProtocol.SourceBreakpoint[]>` - Breakpoint mirroring cache

### Utility Functions

**createInstanceId() (L20-22):** Generates unique 8-character hex identifiers for manager instances

**createChildSafePolicy() (L24-59):** Critical security function that strips reverse debugging capabilities from child sessions to prevent infinite recursion. Returns modified policy with:
- `supportsReverseStartDebugging: false`
- `childSessionStrategy: 'none'`
- Cleared child-specific behaviors (breakpoint mirroring, command routing, etc.)
- Wrapped `handleReverseRequest` to acknowledge but not spawn grandchildren

## Key Methods

### Session Management
**createChildSession() (L186-258):** Primary orchestration method for child session creation with comprehensive error handling and state management:
1. Validates adoption eligibility and prevents concurrent adoptions
2. Dynamically imports MinimalDapClient to avoid circular dependencies
3. Creates child-safe policy and establishes DAP connection
4. Executes initialization sequence: initialize → configure → attach → post-attach handling
5. Implements retry logic for attachment with exponential backoff

**isAdopted() (L102-104):** Prevents duplicate target adoption
**hasActiveChildren() (L117-121):** State query for session routing decisions
**shouldRouteToChild() (L134-159):** Command routing logic based on DAP behavior configuration

### Configuration and Initialization
**initializeChild() (L263-279):** Sends DAP initialize request with standardized client identification
**configureChild() (L284-320):** Applies breakpoint mirroring and exception filters, conditionally sends configurationDone
**attachChild() (L325-349):** Robust attachment with 20-retry mechanism and 200ms intervals

### Event Management
**wireChildEvents() (L414-432):** Establishes event forwarding from child to parent sessions:
- Forwards all child events as 'childEvent' emissions
- Handles connection cleanup on child close
- Maintains activeChild state consistency

**waitForEvent() (L437-468):** Generic event waiting utility with timeout handling for DAP protocol synchronization

## Architectural Patterns

**State Machine Design:** Uses adoption flags (`adoptionInProgress`, `childConfigComplete`) to prevent race conditions during concurrent child creation attempts.

**Event-Driven Architecture:** Leverages EventEmitter pattern for loose coupling between child sessions and parent components.

**Dynamic Imports:** Uses dynamic import for MinimalDapClient (L211) to break circular dependency cycles in the module graph.

**Retry Patterns:** Implements exponential backoff for child attachment (L333-343) to handle timing-sensitive DAP protocol interactions.

## Dependencies

- `@vscode/debugprotocol` - DAP protocol type definitions
- `@debugmcp/shared` - Policy and configuration types
- `./minimal-dap.js` - DAP client implementation (dynamically imported)
- `../utils/logger.js` - Logging infrastructure

## Critical Invariants

1. **No Recursive Debugging:** Child policies must never support reverse debugging to prevent infinite session spawning
2. **Single Active Child:** Only one activeChild can exist at a time, enforced through adoption state tracking  
3. **Breakpoint Consistency:** All stored breakpoints are mirrored to new children if policy enables it
4. **Graceful Cleanup:** Child sessions are properly shutdown and removed from tracking maps on close events