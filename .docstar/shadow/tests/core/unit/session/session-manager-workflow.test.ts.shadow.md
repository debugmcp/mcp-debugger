# tests/core/unit/session/session-manager-workflow.test.ts
@source-hash: da0dc42352e65cec
@generated: 2026-02-09T18:14:24Z

## Purpose
Integration test suite for SessionManager's debug session workflows, focusing on end-to-end debugging scenarios and complex state transitions.

## Test Structure
- **Main Test Suite** (L9): "SessionManager - Debug Session Workflow" - tests complete debugging cycles
- **Setup/Teardown** (L14-32): Configures mock dependencies, fake timers, and SessionManager instance
- **Complete Debug Cycle Suite** (L34-148): Tests full workflow scenarios

## Key Test Cases

### Full Debug Workflow Test (L35-83)
Tests complete debugging lifecycle:
1. Session creation with MOCK language
2. Start debugging with stopOnEntry=true
3. Breakpoint setting and verification
4. Step-over execution
5. Session termination
Validates state transitions (CREATED → PAUSED → STOPPED) and DAP protocol interactions.

### Dry Run Workflow Test (L85-114)
Tests dry-run debugging mode:
- Validates dry-run flag propagation to proxy manager
- Ensures session ends in STOPPED state without actual execution
- Verifies no premature proxy exit errors
- Confirms dryRunSpawn configuration

### StopOnEntry=false Workflow Test (L116-147)
Tests non-stopping startup behavior:
- Configures mock to skip initial stop
- Validates direct transition to RUNNING state
- Tests custom event handling for adapter configuration

## Dependencies
- **SessionManager** (L5): Main class under test from session-manager.js
- **Mock Dependencies** (L7): Test utilities for dependency injection
- **Shared Types** (L6): DebugLanguage and SessionState enums
- **Vitest Framework** (L4): Testing utilities with fake timers

## Test Patterns
- Uses fake timers with `shouldAdvanceTime: true` for async event simulation
- Leverages mock proxy manager for DAP protocol simulation
- Employs `vi.runAllTimersAsync()` for event loop advancement
- Validates both success states and internal call patterns

## Critical Assertions
- State transition validation at each workflow stage
- DAP command verification (setBreakpoints, step operations)
- Error condition handling (proxy exit scenarios)
- Configuration propagation (stopOnEntry, dryRun flags)