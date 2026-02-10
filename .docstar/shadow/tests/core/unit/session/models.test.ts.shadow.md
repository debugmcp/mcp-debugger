# tests/core/unit/session/models.test.ts
@source-hash: 5783779d9ff6dbbe
@generated: 2026-02-09T18:14:22Z

## Purpose
Comprehensive unit tests for session model state mapping functions in the DebugMCP system. Tests critical backward compatibility between legacy flat state model (`SessionState`) and new hierarchical state model (`SessionLifecycleState` + `ExecutionState`).

## Test Structure & Coverage

### Core Mapping Functions Tested
- **mapLegacyState** (L19-84): Tests conversion from legacy flat states to new hierarchical model
- **mapToLegacyState** (L86-151): Tests conversion from new hierarchical model back to legacy states
- **Round-trip consistency** (L153-202): Validates bidirectional mapping integrity

### Key State Mappings Validated

**Legacy → New Model (mapLegacyState):**
- `CREATED` → `{lifecycle: CREATED}` (L20-26)
- `INITIALIZING` → `{lifecycle: ACTIVE, execution: INITIALIZING}` (L28-34)  
- `READY` → `{lifecycle: ACTIVE, execution: INITIALIZING}` (L36-42)
- `RUNNING` → `{lifecycle: ACTIVE, execution: RUNNING}` (L44-50)
- `PAUSED` → `{lifecycle: ACTIVE, execution: PAUSED}` (L52-58)
- `STOPPED` → `{lifecycle: TERMINATED}` (L60-66)
- `ERROR` → `{lifecycle: ACTIVE, execution: ERROR}` (L68-74)

**New → Legacy Model (mapToLegacyState):**
- Terminal lifecycle states (`CREATED`, `TERMINATED`) take precedence over execution states (L87-105)
- `ACTIVE` lifecycle maps to execution-dependent legacy states (L107-142)

### Enum Validation Tests (L204-268)
- **DebugLanguage**: Validates 6 supported languages including Python, JavaScript, Java, Rust, Go, and Mock (L205-222)
- **SessionLifecycleState**: 3 states - CREATED, ACTIVE, TERMINATED (L224-235) 
- **ExecutionState**: 5 states - INITIALIZING, RUNNING, PAUSED, TERMINATED, ERROR (L237-250)
- **SessionState (legacy)**: 7 states for backward compatibility (L252-267)

### Edge Case Coverage
- String value handling for JSON deserialization compatibility (L77-83, L145-150)
- All possible state combination validation without errors (L270-290)
- Type definition verification with mock DebugSession object (L292-314)

## Critical Design Insights
- **Backward Compatibility**: READY legacy state maps to INITIALIZING in new model, creating intentional round-trip inconsistency (L168-173)
- **Hierarchical State Model**: New model separates session lifecycle from execution state for better debugging granularity
- **Error Handling**: All mapping functions are designed to never throw, ensuring robust state transitions

## Dependencies
- **vitest**: Testing framework (L8)
- **@debugmcp/shared**: Core session models and enums (L9-16)