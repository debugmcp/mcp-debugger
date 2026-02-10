# packages/adapter-javascript/tests/unit/javascript-debug-adapter.lifecycle.edge.test.ts
@source-hash: abc1a5259b664feb
@generated: 2026-02-09T18:14:02Z

## Edge Case Test Suite for JavascriptDebugAdapter Lifecycle

**Primary Purpose:** Tests edge cases and specific behaviors in JavascriptDebugAdapter lifecycle operations, focusing on warning handling during initialization and cache clearing during disposal.

### Key Test Structure
- **Test Suite** (L17): `JavascriptDebugAdapter.lifecycle (edge)` - focuses on edge scenarios
- **Mock Dependencies** (L7-15): Minimal AdapterDependencies stub with mocked logger functions
- **Setup** (L18-21): beforeEach hook that restores and clears all mocks

### Critical Test Cases

#### 1. Warning Logging Test (L23-44)
- **Purpose**: Validates that initialization logs each warning exactly once and transitions to READY state
- **Key Behaviors**:
  - Mocks `validateEnvironment` to return warnings with codes 'W1' and 'W2' (L28-32)
  - Verifies logger.warn called exactly twice with correct messages (L37-39)
  - Confirms state transition to `AdapterState.READY` (L42)
  - Validates 'initialized' event emission (L43)

#### 2. Cache Clearing Test (L46-71)
- **Purpose**: Ensures `dispose()` properly clears per-instance caches
- **Key Behaviors**:
  - Mocks `exec.findNode` to return platform-specific node path (L49-51)
  - Tests caching behavior: first call hits `findNode`, second call uses cache (L54-61)
  - Verifies `dispose()` clears caches and resets state to UNINITIALIZED (L64-65)
  - Confirms subsequent calls after disposal re-invoke underlying `findNode` (L67-70)

### Dependencies
- **JavascriptDebugAdapter** (L3): Main class under test from `../../src/index.js`
- **AdapterState** (L4): State enum from `@debugmcp/shared`
- **exec module** (L5): Executable resolver utilities for mocking `findNode`
- **Vitest**: Testing framework with mocking capabilities

### Architectural Insights
- Tests validate proper cache lifecycle management in adapter instances
- Ensures warning aggregation and logging works correctly during initialization
- Validates event-driven architecture with 'initialized' event emission
- Cross-platform path handling for executable resolution testing