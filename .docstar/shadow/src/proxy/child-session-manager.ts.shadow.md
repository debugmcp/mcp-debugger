# src/proxy/child-session-manager.ts
@source-hash: be3a89035593d014
@generated: 2026-02-10T00:42:00Z

**Primary Purpose**: Manages child debug adapter sessions for multi-session debugging scenarios, particularly JavaScript debugging with js-debug/pwa-node which requires concurrent sessions. Handles child session creation, lifecycle management, event forwarding, and breakpoint mirroring.

**Core Classes & Functions**:
- `ChildSessionManager` (L68-496): Main orchestrator for child session lifecycle
- `createChildSafePolicy()` (L24-59): Creates adapter policy variants that disable reverse debugging in child sessions to prevent infinite recursion
- `createInstanceId()` (L20-22): Generates unique hex identifiers for manager instances

**Key State Management** (L75-86):
- `adoptedTargets`: Set tracking pending target IDs to prevent double-adoption
- `childSessions`: Map of pending ID to MinimalDapClient instances  
- `activeChild`: Current primary child session reference
- `storedBreakpoints`: Cached breakpoints for mirroring to new children
- `adoptionInProgress`: Flag preventing concurrent child creation

**Critical Methods**:
- `createChildSession()` (L186-258): Main entry point for child session creation with retry logic and comprehensive error handling
- `shouldRouteToChild()` (L134-159): Determines if DAP commands should be routed to child sessions based on policy configuration
- `storeBreakpoints()` (L163-181): Caches and mirrors breakpoints to active children
- `wireChildEvents()` (L413-432): Forwards child DAP events to parent session

**Session Lifecycle Flow**:
1. `initializeChild()` (L262-279): Sends DAP initialize request with timeout handling
2. `configureChild()` (L283-320): Sets exception breakpoints and mirrors stored breakpoints  
3. `attachChild()` (L324-349): Attaches to pending target with retry logic (max 20 attempts)
4. `handlePostAttachInit()` (L353-373): Handles post-attach initialized events
5. `ensureChildStopped()` (L377-409): Forces pause if policy requires it

**Dependencies**:
- `@vscode/debugprotocol`: DAP types and interfaces
- `@debugmcp/shared`: Policy and configuration types
- `./minimal-dap.js`: Dynamically imported to avoid circular dependencies (L211)
- `../utils/logger.js`: Logging infrastructure

**Architectural Patterns**:
- EventEmitter pattern for child session lifecycle events (`childCreated`, `childError`, `childClosed`, `childEvent`)
- Policy-driven behavior configuration through `AdapterPolicy` and `DapClientBehavior`
- Defensive programming with extensive try-catch blocks and timeout handling
- State machine pattern for adoption lifecycle management

**Critical Invariants**:
- Only one adoption process can run concurrently (enforced by `adoptionInProgress` flag)
- Child sessions use modified policies that disable reverse debugging to prevent recursion
- Breakpoint mirroring is conditional on policy configuration
- All child sessions are properly cleaned up on shutdown

**Error Handling**:
- Comprehensive timeout handling for all DAP operations
- Retry logic for child attachment (up to 20 attempts with 200ms delays)
- Graceful degradation when optional operations fail (breakpoint mirroring, configuration)
- Proper cleanup in error scenarios