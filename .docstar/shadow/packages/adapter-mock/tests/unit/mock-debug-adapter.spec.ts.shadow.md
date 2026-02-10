# packages/adapter-mock/tests/unit/mock-debug-adapter.spec.ts
@source-hash: a963214dd1985ed6
@generated: 2026-02-09T18:14:05Z

## Purpose
Comprehensive unit test suite for the MockDebugAdapter class, validating state transitions, connection handling, DAP event processing, feature support, and error scenarios in the @debugmcp/adapter-mock package.

## Test Structure
- **Primary test suite**: MockDebugAdapter (L24-118) with beforeEach setup (L27-29)
- **Mock dependencies factory**: createDependencies (L6-22) creates minimal AdapterDependencies with vi.fn() mocked logger

## Key Test Categories

### Initialization & State Management (L31-50)
- **Successful initialization test** (L31-42): Verifies state progression from INITIALIZING → READY with event tracking
- **Failed initialization test** (L44-50): Tests error scenario handling with EXECUTABLE_NOT_FOUND causing ERROR state

### Connection Lifecycle (L52-77)
- **Connect/disconnect flow** (L52-67): Tests connection state transitions with logging verification and connection flag management
- **Connection timeout error** (L69-77): Validates error scenario handling with CONNECTION_TIMEOUT producing appropriate AdapterErrorCode

### DAP Event Processing (L79-97)
- **Event handling test** (L79-97): Verifies DAP event processing for 'stopped' (sets threadId, transitions to DEBUGGING) and 'terminated' (clears threadId, returns to CONNECTED) events

### Feature Support System (L99-110)
- **Feature configuration test** (L99-110): Validates feature support detection and requirement reporting based on adapter configuration

### Error Handling & Messaging (L112-117)
- **Error translation test** (L112-117): Tests installation instructions, missing executable errors, and filesystem error message translation

## Dependencies
- **Testing framework**: vitest (describe, it, expect, beforeEach)
- **Core types**: @debugmcp/shared (DebugFeature, AdapterState, AdapterErrorCode, AdapterDependencies)
- **Test target**: MockDebugAdapter, MockErrorScenario from ../../src/mock-debug-adapter.js

## Test Patterns
- State transition tracking via event listeners
- Mock dependency injection with stubbed services
- Error scenario simulation through MockErrorScenario configuration
- Async/await patterns for adapter lifecycle operations