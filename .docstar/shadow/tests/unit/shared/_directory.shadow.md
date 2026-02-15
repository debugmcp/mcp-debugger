# tests\unit\shared/
@children-hash: 356f9fe833748e71
@generated: 2026-02-15T09:01:24Z

## Purpose

Unit test suite for shared debugging infrastructure components, validating adapter policy implementations, filesystem abstractions, and core debugging behaviors across different language environments (JavaScript/Node.js, Python, Mock adapters).

## Test Coverage Areas

### Adapter Policy System
The directory contains comprehensive tests for the adapter policy architecture that manages debug session behavior across different runtime environments:

- **DefaultAdapterPolicy**: Base no-op implementation providing safe defaults for all adapter interface methods
- **JsDebugAdapterPolicy**: JavaScript/Node.js specific debugging with command queuing, stack frame filtering, variable extraction, and handshake flow management
- **PythonAdapterPolicy**: Python debugger integration with environment path resolution and debugpy adapter detection
- **MockAdapterPolicy**: Test-specific adapter for development and testing scenarios

### Core Testing Patterns

**State Management Validation**: All adapter policies test initialization states, connectivity tracking, and command/event-based state transitions following the pattern:
- `createInitialState()` → `updateStateOnEvent()` → `updateStateOnCommand()` → state query methods

**Command Flow Testing**: Extensive validation of Debug Adapter Protocol (DAP) command ordering and queueing:
- Pre-initialization command buffering
- Phase-specific command processing (initialize → setBreakpoints → configurationDone → launch/attach)
- Handshake flow integration testing with mocked event emitters

**Data Extraction**: Tests for filtering and transforming debug data:
- Stack frame filtering (excluding internals, preserving application frames)  
- Local variable extraction with special variable handling
- Child session argument building and validation

### Filesystem Abstraction Testing

**NodeFileSystem Tests**: Validates filesystem abstraction layer providing:
- Safe delegation to Node.js `fs` module operations
- Error-tolerant fallbacks (false for `existsSync`, empty string for `readFileSync`)
- Global filesystem instance management with override capabilities

## Key Integration Points

### Adapter Detection & Matching
All adapter policies implement `matchesAdapter()` for runtime identification based on command signatures and arguments, enabling dynamic adapter selection.

### Debug Session Lifecycle
Tests validate complete debug session workflows:
1. **Initialization**: Adapter startup and configuration
2. **Handshake**: DAP protocol negotiation and setup commands
3. **Runtime**: Command queueing, state tracking, and data extraction
4. **Child Sessions**: Multi-target debugging support (where applicable)

### Cross-Platform Compatibility
Tests include platform-specific behavior validation (Windows vs Unix executable resolution) and environment variable handling.

## Testing Infrastructure

### Mock Management
- Extensive use of Vitest mocking (`vi.fn()`, `vi.mock()`)
- Fake timer control for async operation testing  
- Environment variable capture/restore patterns
- Process platform spoofing for cross-platform testing

### Test Data Structures
- Mock DAP events and responses using `as any` type assertions
- Hierarchical debug data (frames → scopes → variables)
- Real filesystem fixtures (package.json) for integration testing

This test suite ensures the shared debugging infrastructure provides reliable, cross-language debug adapter management with proper error handling, state management, and protocol compliance.