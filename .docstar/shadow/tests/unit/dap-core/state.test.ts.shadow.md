# tests/unit/dap-core/state.test.ts
@source-hash: c03365d27c5feeb5
@generated: 2026-02-09T18:14:42Z

## DAP Core State Management Test Suite

**Purpose**: Comprehensive unit tests for the Debug Adapter Protocol (DAP) core state management system, focusing on immutable state operations and pending request tracking.

### Test Structure

**Main Test Suites (L18-164)**:
- `createInitialState` (L19-29): Validates initial state creation with correct defaults
- `setInitialized` (L31-40): Tests initialization flag updates with immutability
- `setAdapterConfigured` (L42-50): Tests adapter configuration flag updates
- `setCurrentThreadId` (L52-67): Tests thread ID management including clearing
- `pending requests` (L69-118): Comprehensive testing of request queue management
- `updateState` (L120-136): Tests batch state updates
- `immutability` (L138-163): Dedicated immutability validation tests

### Key Test Patterns

**Immutability Verification**: Every state mutation test includes explicit checks that original state objects remain unchanged (L38, L48, L58, L84, L105, L116, L134)

**Pending Request Management (L70-118)**:
- Uses sample `PendingRequest` object (L70-75) with DAP-specific structure
- Tests CRUD operations: add, get, remove, clear
- Validates Map-based storage with proper sizing and key existence checks

**Frozen State Testing (L139-148)**: Uses `Object.freeze()` to ensure state functions don't attempt mutation, validating true functional programming approach

### Dependencies

**Testing Framework**: Vitest with standard assertions (`describe`, `it`, `expect`) (L4)
**State Module**: Imports 8 state management functions from `../../../src/dap-core/state.js` (L5-15)
**Types**: Imports `PendingRequest` type from DAP core types (L16)

### Architecture Insights

**State Design**: Tests reveal immutable state pattern with:
- Session-based state initialization
- Boolean flags for initialization and adapter configuration
- Optional thread ID tracking
- Map-based pending request storage
- Batch update capability

**Quality Assurance**: Strong emphasis on immutability testing suggests the state system is designed for functional programming patterns typical in DAP implementations where state changes must be predictable and traceable.