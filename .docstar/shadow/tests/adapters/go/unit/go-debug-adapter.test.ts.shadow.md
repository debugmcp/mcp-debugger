# tests/adapters/go/unit/go-debug-adapter.test.ts
@source-hash: f94e3cb854fbd565
@generated: 2026-02-10T00:41:19Z

## Purpose
Comprehensive unit test suite for `GoDebugAdapter` class, testing Go/Delve debugger integration functionality including initialization, state management, connection handling, capabilities, and configuration transformations.

## Test Structure
- **Test framework**: Vitest with mocking capabilities (L1-17)
- **Mock setup**: Mocked `child_process.spawn` and comprehensive `AdapterDependencies` mock factory (L9-51)
- **Test lifecycle**: Setup/teardown with mock clearing (L57-66)

## Key Test Groups

### Basic Properties Tests (L68-84)
- Validates adapter language, name, initial state, and readiness
- Confirms `DebugLanguage.GO` and "Go Debug Adapter (Delve)" identity

### Initialization Tests (L86-141)
- **Success path** (L87-111): Tests transition to READY state when Go/Delve available
- **Event emission** (L113-132): Validates 'initialized' event firing  
- **Error handling** (L134-140): Tests ERROR state on missing Go executable
- Uses mocked `fs.promises.access` and `spawn` with simulated Go version output

### Lifecycle Management (L143-203)
- **Disposal** (L143-171): Tests state reset and 'disposed' event emission
- **Connection flow** (L173-203): Tests CONNECTED/DISCONNECTED state transitions and event emission

### Feature Support Tests (L205-260)
- **Dependencies** (L205-214): Validates Go and Delve as required dependencies
- **Feature flags** (L216-236): Tests support for conditional breakpoints, function breakpoints, log points, terminate requests; confirms no step-back support
- **Capabilities** (L238-260): Comprehensive DAP capabilities validation including exception filters for 'panic' and 'fatal'

### Error Translation (L262-298)
Tests human-readable error message translation for common failure scenarios:
- dlv/go command not found
- Permission denied  
- Process launch/attach failures
- Unknown error passthrough

### Configuration & Command Building (L300-373)
- **Installation instructions** (L300-307): Validates help text generation
- **Missing executable errors** (L309-315): Tests error message formatting
- **Command building** (L317-346): Tests `dlv dap` command construction with proper arguments
- **Config transformation** (L348-373): Tests generic-to-Go-specific launch configuration conversion, including test mode handling

## Key Dependencies
- `@debugmcp/adapter-go.GoDebugAdapter`: Primary class under test
- `@debugmcp/shared`: Types and enums (`AdapterState`, `DebugLanguage`, `DebugFeature`)
- Mocked Node.js modules: `child_process`, `fs`, process environment

## Test Patterns
- Extensive mocking of external dependencies (file system, process spawning)
- State transition validation throughout adapter lifecycle
- Event-driven behavior verification
- Error condition simulation and handling validation