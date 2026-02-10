# tests/core/unit/session/models.test.ts
@source-hash: 5783779d9ff6dbbe
@generated: 2026-02-10T00:41:18Z

## Primary Purpose
Comprehensive unit test suite for debugging session state models and mapping functions, ensuring backward compatibility between legacy and new state models. Critical for validating the debugging session lifecycle management system.

## Key Test Groups

### mapLegacyState Tests (L19-84)
Tests conversion from legacy SessionState enum to new {lifecycle, execution} model:
- **CREATED** → {lifecycle: CREATED} (L20-26)
- **INITIALIZING/READY** → {lifecycle: ACTIVE, execution: INITIALIZING} (L28-42)
- **RUNNING/PAUSED/ERROR** → {lifecycle: ACTIVE, execution: respective state} (L44-74)
- **STOPPED** → {lifecycle: TERMINATED} (L60-66)
- String value compatibility test (L77-83)

### mapToLegacyState Tests (L86-151)
Tests reverse conversion from {lifecycle, execution} to legacy SessionState:
- Lifecycle precedence: CREATED/TERMINATED override execution state (L87-105)
- **ACTIVE lifecycle mappings** (L107-142): execution state determines legacy state
- Default ACTIVE → READY when execution undefined (L133-141)
- String value compatibility (L145-150)

### Round-trip Consistency Tests (L153-202)
Validates bidirectional mapping consistency for all states:
- Tests legacy → new → legacy conversion preserves original state
- **Exception**: READY maps to INITIALIZING in round-trip (L172)

### Enum Validation Tests (L204-268)
Verifies enum definitions and completeness:
- **DebugLanguage**: 6 languages including python, javascript, java, rust, go, mock (L205-222)
- **SessionLifecycleState**: 3 states (created, active, terminated) (L224-235)
- **ExecutionState**: 5 states (initializing, running, paused, terminated, error) (L237-250)
- **SessionState (legacy)**: 7 states (L252-267)

### Edge Cases & Robustness (L270-290)
- Exhaustive combination testing to prevent runtime errors (L271-281)
- Error-free handling of all legacy states (L283-289)

### Type Integration Test (L292-314)
Validates TypeScript type exports and DebugSession interface structure using mock object construction (L298-310).

## Dependencies
- **vitest**: Testing framework (L8)
- **@debugmcp/shared**: Core session models and mapping functions (L9-16)

## Architecture Insights
- Demonstrates two-tier state model: high-level lifecycle + detailed execution states
- Emphasizes backward compatibility for existing debugging tools
- Comprehensive edge case coverage indicates production-critical functionality
- Type-safe enum validation ensures API contract integrity