# tests/unit/shared/
@generated: 2026-02-10T21:26:24Z

## Purpose
Unit test suite for shared debug adapter components and infrastructure. This directory validates the core abstractions and policies that enable multi-language debugging support in the debug ecosystem.

## Key Components

### Adapter Policy Testing Framework
The directory tests a polymorphic adapter policy system that provides language-specific debugging behaviors:

- **DefaultAdapterPolicy** - Base no-op implementation providing safe fallbacks
- **JsDebugAdapterPolicy** - JavaScript/Node.js debugging with command queueing and child session support  
- **PythonAdapterPolicy** - Python debugpy integration with environment handling
- **MockAdapterPolicy** - Testing harness for development and validation

### Core Functionality Areas

**Debug Session Management**: Tests initialization handshakes, state tracking, and configuration flows that coordinate between debug adapters and the VS Code Debug Adapter Protocol (DAP).

**Command Orchestration**: Validates language-specific command queueing, ordering requirements (especially for JavaScript's complex initialization sequence), and state-dependent execution logic.

**Multi-Process Debugging**: Tests child session handling for languages that spawn additional processes during debugging, with adapter-specific argument generation.

**Data Filtering & Processing**: Validates stack frame filtering (removing internal frames), local variable extraction with language-specific exclusion rules, and debug event classification.

**Environment Integration**: Tests executable path resolution, platform-specific defaults, and environment variable handling across different debugging targets.

### Filesystem Abstraction Testing
Tests the `NodeFileSystem` implementation that provides:
- Safe delegation to Node.js fs operations with error handling fallbacks
- Global filesystem instance management for dependency injection
- Graceful degradation when filesystem operations fail

## Public API Surface

### Entry Points
- **Adapter Policy Classes**: Provide `matchesAdapter()`, `buildChildStartArgs()`, `extractLocalVariables()`, state management methods
- **Filesystem Interface**: `existsSync()`, `readFileSync()` with error-safe defaults
- **Policy Registration**: `setDefaultFileSystem()`, `getDefaultFileSystem()` for instance management

### Key Patterns
- **Polymorphic Adapter Detection**: Each policy implements `matchesAdapter()` to identify compatible debug configurations
- **State Machine Management**: All policies track initialization phases (`initialized`, `configurationDone`, `connected`) 
- **Command Flow Control**: Language-specific queueing and ordering logic for DAP commands
- **Safe Defaults**: Comprehensive fallback behaviors when operations fail or adapters are unavailable

## Internal Organization

### Test Structure
- Each policy has dedicated test suite covering full interface compliance
- Integration tests simulate complete handshake flows with mock DAP communication
- Error handling tests validate graceful degradation scenarios
- Cross-platform testing ensures consistent behavior across Windows/Unix systems

### Data Flow
1. **Adapter Identification**: Command patterns determine appropriate policy
2. **Session Initialization**: Policies orchestrate DAP handshake sequences
3. **Runtime Management**: Ongoing state tracking and command processing
4. **Data Processing**: Stack frames and variables filtered through policy-specific rules

The test suite ensures this shared infrastructure provides reliable, language-agnostic debugging foundations while allowing for adapter-specific customization and optimization.