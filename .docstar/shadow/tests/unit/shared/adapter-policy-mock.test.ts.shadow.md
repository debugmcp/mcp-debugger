# tests/unit/shared/adapter-policy-mock.test.ts
@source-hash: 0fddf311fd528030
@generated: 2026-02-10T00:41:35Z

## Purpose
Unit test suite for `MockAdapterPolicy` class, testing adapter matching, state management, variable extraction, spawn configuration, and child session handling.

## Test Structure
- **Main test suite** (L4-101): `describe('MockAdapterPolicy')` containing 5 test cases
- **Import dependencies** (L1-2): Vitest testing framework and MockAdapterPolicy class

## Key Test Cases

### Adapter Command Matching (L5-26)
Tests `MockAdapterPolicy.matchesAdapter()` method:
- Validates detection of mock adapter in command paths (L7-11)
- Validates detection of mock adapter in Node.js args (L13-18)  
- Confirms rejection of non-mock commands (L20-25)

### State Management (L28-40)
Tests initialization and configuration tracking:
- `createInitialState()` returns uninitialized state (L29-31)
- `updateStateOnEvent?.()` handles 'initialized' events (L33-36)
- `updateStateOnCommand?.()` handles 'configurationDone' commands (L38-39)
- `isInitialized()` and `isConnected()` state queries (L35-36)

### Variable Extraction (L42-65)
Tests `extractLocalVariables?.()` method with mock stack frames:
- Uses hierarchical scope structure: frames → scopes → variables
- Extracts variables from first scope of top frame (L43-64)
- Returns array of variable objects with name/value pairs

### Spawn Configuration (L67-94)
Tests `getAdapterSpawnConfig?.()` method:
- Returns spawn config when `adapterCommand` provided (L68-85)
- Returns undefined when no adapter command specified (L87-93)
- Passes through command, args, host, and port values

### Child Session Restriction (L96-100)
Tests `buildChildStartArgs()` method:
- Verifies it throws error for unsupported child sessions (L97-99)

## Dependencies
- **Vitest**: Testing framework for describe/it/expect
- **MockAdapterPolicy**: Main class under test from shared interfaces

## Architectural Notes
- Uses optional chaining (`?.`) extensively, suggesting MockAdapterPolicy methods may be conditionally defined
- Mock data structures use `as any` type assertions for test convenience (L50, L57)
- Tests cover both positive and negative cases for adapter detection
- State management follows event-driven pattern with separate event and command handlers