# tests\adapters\go\unit\go-debug-adapter.test.ts
@source-hash: c14c8628e777dc5a
@generated: 2026-02-12T21:00:37Z

## Purpose
Unit test suite for the GoDebugAdapter class using Vitest, validating Go debugger integration with Delve. Tests adapter lifecycle, state management, dependency validation, and DAP (Debug Adapter Protocol) command building.

## Key Components

### Test Setup (L9-51)
- **mockSpawn** (L17): Mocked child_process.spawn for process execution simulation
- **createMockDependencies** (L19-51): Factory creating comprehensive AdapterDependencies mock with file system, logger, environment, and process launcher stubs

### Test Structure (L53-379)
- **Basic Properties Tests** (L68-84): Validates language=GO, name, initial UNINITIALIZED state
- **Initialize Tests** (L86-146): Tests Go/Delve availability checks, state transitions to READY/ERROR
- **Dispose Tests** (L148-176): Validates cleanup and state reset to UNINITIALIZED
- **Connection Tests** (L178-208): Tests CONNECTED/DISCONNECTED state transitions with host/port
- **Dependencies Tests** (L210-219): Validates required Go and Delve dependencies
- **Feature Support Tests** (L221-241): Tests DebugFeature support (conditional breakpoints, log points, etc.)
- **Capabilities Tests** (L243-265): Validates DAP capabilities and exception filters
- **Error Translation Tests** (L267-303): Tests user-friendly error message transformations
- **Installation Instructions Tests** (L305-312): Validates help text generation
- **Command Building Tests** (L322-351): Tests dlv dap command construction
- **Launch Config Tests** (L353-378): Tests generic-to-Go config transformation

## Test Patterns

### Mocking Strategy
- Child process spawn mocking with EventEmitter simulation
- Process stdout/stderr data injection via Buffer.from()
- File system access mocking for executable detection
- Environment variable manipulation for PATH testing

### State Validation
- Consistent state transition testing (UNINITIALIZED → READY → CONNECTED)
- Event emission verification (initialized, connected, disposed events)
- Bi-directional state checking (getState() and convenience methods)

## Key Assertions
- Go version parsing from stdout: 'go version go1.21.0 darwin/arm64'
- DAP command structure: dlv dap --listen=host:port
- Exception filters: 'panic' and 'fatal' breakpoint filters
- Error message translation for common Go/Delve issues

## Dependencies
- **@debugmcp/adapter-go**: GoDebugAdapter class under test
- **@debugmcp/shared**: AdapterDependencies, AdapterState, DebugLanguage, DebugFeature types
- **vitest**: Testing framework with mocking capabilities
- **events.EventEmitter**: Process simulation in mocks