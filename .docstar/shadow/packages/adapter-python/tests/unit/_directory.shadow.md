# packages\adapter-python\tests\unit/
@children-hash: 21e0e19bec355a0c
@generated: 2026-02-15T09:01:23Z

## Python Adapter Unit Test Suite

**Overall Purpose:** Comprehensive unit test suite for the Python debug adapter implementation, providing thorough validation of Python environment discovery, adapter lifecycle management, and factory pattern functionality. This test directory ensures the Python adapter can reliably detect Python installations, validate development environments, and manage debug sessions across different platforms.

### Key Components & Architecture

**Core Test Modules:**
- **`python-adapter-factory.test.ts`**: Tests the factory pattern implementation for creating Python debug adapters, including metadata generation and environment validation
- **`python-debug-adapter.spec.ts`**: Tests the main adapter class lifecycle, initialization, state management, and error handling
- **`python-utils.comprehensive.test.ts`**: Extensive cross-platform testing of Python executable discovery utilities with edge cases and error scenarios
- **`python-utils.discovery.test.ts`**: Focused testing of Python discovery functionality across different environment configurations

### Testing Infrastructure & Patterns

**Shared Testing Utilities:**
- **Mock Setup Patterns**: Consistent mocking of `child_process.spawn`, file system operations, and external dependencies across all test files
- **Environment Simulation**: Sophisticated helpers for simulating different Python installations, versions, and platform-specific behaviors
- **Process Mocking**: `createSpawn()` and similar utilities that simulate subprocess execution with configurable outputs and exit codes

**Common Test Patterns:**
- Cross-platform testing (Windows, Linux, macOS) with platform-specific behavior validation
- Environment variable manipulation with proper cleanup hooks
- Async testing with event-driven adapter lifecycle validation
- Comprehensive error scenario coverage including missing executables, version incompatibilities, and module availability

### Key Validation Areas

**Environment Discovery & Validation:**
- Python executable detection across platforms with PATH analysis
- Windows Store alias filtering and detection
- Environment variable precedence (`PYTHON_EXECUTABLE`, `pythonLocation`, `PYTHON_PATH`)
- Python version validation (>= 3.7 requirement)
- debugpy module availability checking with fallback behavior

**Adapter Lifecycle Management:**
- Factory pattern implementation for adapter creation
- Initialization state transitions (UNINITIALIZED → READY/ERROR)
- Event emission and listener management
- Proper resource cleanup and disposal
- Error propagation and user-friendly error messages

**Development Environment Support:**
- Virtual environment detection and handling
- Multiple Python installation preference logic (debugpy availability priority)
- CI/development debugging with verbose logging (`DEBUG_PYTHON_DISCOVERY=true`)
- Graceful degradation when optimal configurations aren't available

### Testing Framework Integration

**Dependencies:**
- **Vitest**: Primary testing framework with comprehensive mocking and spying capabilities
- **@debugmcp/shared**: Shared types and enums for adapter states and error codes
- **Node.js Built-ins**: Extensive mocking of `child_process`, `fs`, `path`, and `events` modules

**Test Organization:**
- Modular test structure with focused test suites for specific functionality
- Consistent mock setup and teardown patterns
- Environment preservation and restoration between tests
- Comprehensive edge case and error path coverage

This test suite provides confidence in the Python adapter's ability to reliably discover Python environments, validate development setups, and manage debug sessions across diverse development environments and platforms.