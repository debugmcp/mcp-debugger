# tests/unit/shared/adapter-policy-mock.test.ts
@source-hash: 0fddf311fd528030
@generated: 2026-02-09T18:14:44Z

**Purpose**: Unit tests for MockAdapterPolicy class, validating mock debugging adapter functionality including command matching, state management, variable extraction, spawn configuration, and child session handling.

**Test Structure**:
- Uses vitest testing framework (L1)
- Tests MockAdapterPolicy from shared/interfaces/adapter-policy-mock.js (L2)
- 5 test cases covering core adapter policy behaviors (L4-101)

**Key Test Cases**:

**Adapter Command Matching (L5-26)**:
- Tests `matchesAdapter()` method with various command configurations
- Validates detection of mock adapter identifiers in both command paths and args
- Covers positive cases: `/usr/bin/mock-adapter` and node with `mock-adapter` arg
- Covers negative case: node with non-mock arguments

**State Management (L28-40)**:
- Tests `createInitialState()`, `updateStateOnEvent()`, `updateStateOnCommand()` methods
- Validates initialization and configuration tracking
- Tests state queries: `isInitialized()` and `isConnected()`
- Uses optional chaining for methods that may not exist

**Variable Extraction (L42-65)**:
- Tests `extractLocalVariables()` method with mock stack frames and scopes
- Simulates DAP protocol structure: frames → scopes → variables
- Validates extraction from first scope of top frame
- Uses type assertions (`as any`) for test data

**Spawn Configuration (L67-94)**:
- Tests `getAdapterSpawnConfig()` with and without adapterCommand
- Validates passthrough behavior when adapterCommand provided
- Tests undefined return when no command specified
- Covers host/port configuration forwarding

**Child Session Handling (L96-100)**:
- Tests `buildChildStartArgs()` throws expected error
- Validates mock adapter doesn't support child debugging sessions

**Dependencies**:
- vitest testing framework
- MockAdapterPolicy from shared interfaces

**Architectural Notes**:
- Uses optional chaining extensively, suggesting MockAdapterPolicy methods may be conditionally implemented
- Test data uses DAP (Debug Adapter Protocol) structures
- Mock adapter acts as testing/development substitute for real debug adapters