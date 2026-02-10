# tests/unit/dap-core/state.test.ts
@source-hash: c03365d27c5feeb5
@generated: 2026-02-10T00:41:31Z

## Purpose
Comprehensive unit test suite for DAP (Debug Adapter Protocol) core state management functions using Vitest. Tests immutable state operations including initialization, flag updates, thread management, and pending request tracking.

## Test Structure

### Initial State Testing (L19-29)
- **createInitialState**: Validates state object creation with session ID, default boolean flags (initialized, adapterConfigured), undefined thread ID, and empty pending requests Map

### State Flag Operations (L31-67)
- **setInitialized (L31-40)**: Tests initialization flag updates with immutability verification
- **setAdapterConfigured (L42-50)**: Tests adapter configuration flag updates
- **setCurrentThreadId (L52-67)**: Tests thread ID assignment and clearing (undefined values)

### Pending Request Management (L69-118)
- Uses mock `PendingRequest` object with requestId, command, seq, and timestamp fields (L70-75)
- **addPendingRequest (L77-85)**: Tests adding requests to state Map with immutability
- **getPendingRequest (L87-92)**: Tests request retrieval by ID, including non-existent cases
- **removePendingRequest (L94-106)**: Tests selective request removal while preserving others
- **clearPendingRequests (L108-117)**: Tests complete request Map clearing

### Bulk State Updates (L120-136)
- **updateState**: Tests atomic updates of multiple state properties simultaneously

### Immutability Verification (L138-163)
- Tests all operations against frozen state objects to ensure no mutations (L139-148)
- Validates new Map instance creation for pending requests (L150-162)

## Key Dependencies
- **Vitest**: Testing framework (describe, it, expect)
- **DAP Core State Module**: All state management functions from `../../../src/dap-core/state.js`
- **DAP Core Types**: PendingRequest type definition

## Test Patterns
- Consistent immutability validation across all state operations
- Mock data construction for complex objects (PendingRequest)
- State chaining for multi-step operations
- Frozen object testing to guarantee immutability