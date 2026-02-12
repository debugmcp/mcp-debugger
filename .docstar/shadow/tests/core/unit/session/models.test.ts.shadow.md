# tests/core/unit/session/models.test.ts
@source-hash: 4b3df48e82ca13fd
@generated: 2026-02-11T16:12:52Z

## Purpose
Unit test suite for session state mapping functions and model definitions in the debugMCP system. Tests backward compatibility between legacy session states and a new dual-state model (lifecycle + execution states), which is critical for maintaining debugging session integrity during state transitions.

## Test Structure
### Core State Mapping Tests
- **mapLegacyState tests** (L19-84): Validates conversion from legacy SessionState enum to new {lifecycle, execution} structure
  - Maps single legacy states to lifecycle/execution combinations
  - Handles edge cases like string enum values from JSON
  - Key mappings: CREATED→CREATED lifecycle, RUNNING→ACTIVE+RUNNING, STOPPED→TERMINATED

- **mapToLegacyState tests** (L86-151): Validates reverse conversion from {lifecycle, execution} to legacy SessionState
  - Tests all lifecycle states (CREATED, ACTIVE, TERMINATED)
  - For ACTIVE lifecycle, maps based on execution state or defaults to READY
  - Handles string enum values and undefined execution states

### Consistency & Edge Case Tests
- **Round-trip mapping tests** (L153-202): Ensures legacy→new→legacy conversions preserve original state (with known exceptions like READY→INITIALIZING)
- **Enum definition tests** (L204-267): Validates enum structures and expected values
  - DebugLanguage: 5 languages including python, javascript, rust, go, mock
  - SessionLifecycleState: 3 states (created, active, terminated)
  - ExecutionState: 5 states (initializing, running, paused, terminated, error)
  - SessionState (legacy): 7 states
- **Edge case tests** (L269-289): Validates all possible state combinations don't throw errors
- **Type definition tests** (L291-313): Verifies DebugSession interface structure and type exports

## Key Dependencies
- `@debugmcp/shared`: Provides all enums and mapping functions
- `vitest`: Test framework (describe, it, expect)

## Critical Invariants
- State mappings must be bidirectional where semantically equivalent
- READY legacy state maps to INITIALIZING in new model (not round-trip consistent)
- ACTIVE lifecycle with undefined execution defaults to READY legacy state
- All enum combinations must be handled without throwing errors

## Architectural Notes
- Tests document the migration from a single SessionState enum to a dual-state model separating session lifecycle from execution state
- Comprehensive edge case testing ensures robustness for external data sources
- Type verification tests ensure proper TypeScript exports and interface definitions