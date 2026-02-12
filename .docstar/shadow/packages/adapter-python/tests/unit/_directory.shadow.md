# packages/adapter-python/tests/unit/
@generated: 2026-02-11T23:47:42Z

## Unit Test Suite for Python Debug Adapter

This directory contains comprehensive unit tests for the Python debug adapter package, validating the complete lifecycle of Python environment discovery, adapter creation, and debug session management.

### Overall Purpose
Provides thorough test coverage for the Python debug adapter's core functionality including:
- Python environment discovery and validation across platforms
- Adapter factory pattern implementation
- Debug adapter lifecycle management (initialization, state transitions, cleanup)
- Error handling and user-friendly messaging

### Key Test Components

**PythonAdapterFactory Tests (`python-adapter-factory.test.ts`)**
- Validates factory pattern implementation for creating Python debug adapters
- Tests metadata retrieval and adapter configuration consistency
- Comprehensive environment validation testing (Python version >= 3.7, debugpy availability)
- Mock infrastructure for simulating child process execution and environment detection

**PythonDebugAdapter Core Tests (`python-debug-adapter.spec.ts`)**
- Tests adapter initialization, state management (UNINITIALIZED → READY → ERROR states)
- Event-driven lifecycle testing with initialization success/failure scenarios
- Environment validation integration with comprehensive error reporting
- Cleanup and disposal functionality validation

**Python Discovery Utilities (`python-utils.*.test.ts`)**
- **Comprehensive Suite**: Extensive cross-platform Python executable discovery testing
- **Discovery-Focused Suite**: Core discovery scenarios and environment variable handling
- Platform-specific behavior (Windows Store aliases, Unix PATH resolution, environment variable precedence)
- debugpy module preference logic and fallback mechanisms

### Testing Infrastructure & Patterns

**Mock Framework:**
- Vitest testing framework with comprehensive mocking of Node.js APIs
- Mock factories for `child_process.spawn`, file system operations, and console output
- Platform-specific behavior simulation (`process.platform` mocking)
- Environment variable manipulation with proper cleanup

**Test Utilities:**
- `createDependencies()`: Factory for mock adapter dependencies (logger, environment, fileSystem, processLauncher)
- `createSpawn()`: Helper for simulating Python subprocess execution with configurable outputs
- `setSuccessfulEnvironment()`: Test helper for mocking successful environment setup

**Key Testing Patterns:**
- Event-driven testing for adapter lifecycle events
- Promise-based async testing for initialization scenarios
- Error boundary testing with comprehensive error code validation
- Platform-specific discovery behavior verification
- Verbose logging validation for CI/debugging environments

### Critical Test Coverage Areas

**Environment Validation:**
- Python version compatibility (>= 3.7 requirement)
- debugpy package availability detection
- Virtual environment detection and handling
- Cross-platform executable discovery (Windows Store aliases, PATH resolution)

**Error Handling:**
- User-friendly error message translation
- Graceful fallback mechanisms (debugpy missing, multiple Python installations)
- CI environment specific error reporting
- CommandNotFoundError propagation and logging

**State Management:**
- Adapter state transitions with proper event emission
- Thread ID management and cleanup
- Ready status synchronization
- Initialization failure recovery

### Integration Points
The test suite validates the integration between:
- Factory pattern creation → Adapter initialization
- Environment discovery → Validation → Adapter readiness
- Error detection → User-friendly reporting → State management
- Platform detection → Discovery strategy → Executable selection

This comprehensive test coverage ensures the Python debug adapter can reliably discover Python environments, validate requirements, and provide clear feedback for various development environment configurations across Windows, Linux, and macOS platforms.