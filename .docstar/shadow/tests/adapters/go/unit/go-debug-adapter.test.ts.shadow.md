# tests/adapters/go/unit/go-debug-adapter.test.ts
@source-hash: f94e3cb854fbd565
@generated: 2026-02-09T18:14:13Z

## Purpose
Unit test suite for the GoDebugAdapter class, providing comprehensive coverage of Go debugging functionality using Vitest framework. Tests adapter lifecycle, state management, capabilities, and error handling for Go/Delve debugging integration.

## Key Components

### Mock Setup (L9-51)
- **child_process mock (L9-17)**: Mocks `spawn` function for process execution testing
- **createMockDependencies (L19-51)**: Factory function creating AdapterDependencies mock with filesystem, logger, environment, and process launcher stubs

### Test Structure
- **Basic Properties Tests (L68-84)**: Validates language (GO), name, initial state (UNINITIALIZED), and readiness
- **Initialization Tests (L86-141)**: Tests adapter initialization with Go/Delve availability checks, success/error state transitions, and event emissions
- **Disposal Tests (L143-171)**: Verifies cleanup, state reset, and event handling
- **Connection Management (L173-203)**: Tests connect/disconnect operations and state transitions (CONNECTED/DISCONNECTED)

### Feature Testing
- **Dependencies (L205-214)**: Validates required Go and Delve dependencies
- **Feature Support (L216-236)**: Tests support for conditional breakpoints, function breakpoints, log points, terminate requests, and step back limitations
- **Capabilities (L238-260)**: Comprehensive capability object validation including exception filters for panic/fatal

### Error Handling & Translation (L262-298)
Tests error message translation for common Go debugging errors:
- dlv/go command not found
- Permission denied
- Process launch/attach failures
- Unknown error passthrough

### Configuration & Commands (L300-373)
- **Installation Instructions (L300-307)**: Tests help text generation
- **Command Building (L317-346)**: Validates dlv dap command construction with proper arguments
- **Config Transformation (L348-373)**: Tests generic-to-Go-specific launch configuration transformation, including test mode handling

## Architecture Notes
- Uses Vitest mocking extensively for external dependencies
- EventEmitter pattern for process simulation
- State machine testing with AdapterState enum
- Dependency injection pattern with AdapterDependencies interface
- Comprehensive error message localization testing

## Key Dependencies
- `@debugmcp/adapter-go`: GoDebugAdapter class under test
- `@debugmcp/shared`: Shared types and enums (AdapterState, DebugLanguage, DebugFeature)
- Vitest testing framework with mocking capabilities
- Node.js child_process, fs, and events modules