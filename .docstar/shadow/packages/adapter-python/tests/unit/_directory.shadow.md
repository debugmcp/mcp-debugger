# packages/adapter-python/tests/unit/
@generated: 2026-02-10T21:26:22Z

## Unit Test Suite for Python Debug Adapter

This directory contains comprehensive unit tests for the Python debug adapter functionality, focusing on three core areas: adapter factory creation, adapter lifecycle management, and Python environment discovery utilities.

### Overall Purpose
The test suite validates the Python debug adapter's ability to:
- Discover and validate Python installations across different platforms
- Create and manage debug adapter instances through factory pattern
- Handle environment validation and error scenarios gracefully
- Manage adapter state transitions and lifecycle events

### Key Test Components

**PythonAdapterFactory Tests (`python-adapter-factory.test.ts`)**
- Tests factory pattern implementation for creating `PythonDebugAdapter` instances
- Validates metadata structure (language, version, file extensions)
- Comprehensive environment validation including Python version requirements (≥3.7) and debugpy package availability
- Mock-based testing of subprocess execution for environment checks

**PythonDebugAdapter Tests (`python-debug-adapter.spec.ts`)**
- Tests adapter initialization, state management (UNINITIALIZED → READY/ERROR), and lifecycle
- Event-driven testing for 'initialized' events and state transitions
- Error handling validation with proper error codes (ENVIRONMENT_INVALID)
- Cleanup and disposal testing ensuring proper resource management

**Python Discovery Utilities Tests (`python-utils.*.test.ts`)**
- **Comprehensive test suite** covering cross-platform Python executable discovery
- **Discovery-specific tests** focusing on real-world discovery scenarios
- Platform-specific behavior testing (Windows Store aliases, PATH resolution, environment variables)
- debugpy module preference logic and fallback mechanisms
- Extensive error scenario coverage including CI environment handling

### Internal Organization & Data Flow

**Test Infrastructure Pattern:**
1. **Mock Setup** - Each test file establishes comprehensive mocking for child processes, file system, and external dependencies
2. **Helper Factories** - `createDependencies()` and similar functions provide consistent mock objects across tests
3. **Scenario Simulation** - `simulateSpawn()` and `createSpawn()` helpers enable controlled subprocess behavior testing
4. **Cleanup Management** - Consistent beforeEach/afterEach patterns ensure test isolation

**Test Flow:**
- Factory tests → Environment validation → Adapter initialization → State management → Resource cleanup
- Discovery tests cover the foundational layer that feeds into factory validation

### Key Testing Patterns

**Cross-Platform Validation:**
- Windows-specific testing (Store aliases, `.exe` extensions, `pythonLocation` environment variable)
- Unix-like system testing (PATH resolution, `python3` vs `python` preference)
- Environment variable precedence testing (`PYTHON_EXECUTABLE`, `PythonLocation`, `PYTHON_PATH`)

**Error Boundary Testing:**
- CommandNotFoundError handling for missing Python installations
- Version validation failures (Python < 3.7)
- Missing debugpy package scenarios
- Subprocess execution failures and timeout handling

**Mock Strategy:**
- `child_process.spawn` mocking for subprocess simulation
- File system operation mocking for path validation
- Logger spying for error reporting verification
- Platform-specific behavior mocking using `process.platform`

### Dependencies & Integration Points

**External Dependencies:**
- Vitest testing framework with comprehensive mocking capabilities
- `@debugmcp/shared` package for shared types and enums
- Node.js built-in modules (`child_process`, `fs`, `path`, `events`)

**Internal Dependencies:**
- `python-utils.js` for Python discovery functionality
- `PythonDebugAdapter` class for adapter implementation
- `PythonAdapterFactory` for factory pattern implementation

### Critical Validation Areas
The test suite ensures robust Python environment detection with graceful degradation, proper error reporting for development environment issues, and reliable adapter state management for debugging session lifecycle. Special emphasis on CI environment compatibility and verbose logging for debugging complex discovery scenarios.