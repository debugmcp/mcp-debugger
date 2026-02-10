# packages/adapter-python/tests/
@generated: 2026-02-10T21:26:37Z

## Overall Purpose and Responsibility

This test directory provides comprehensive validation for the `@debugmcp/adapter-python` package, ensuring the Python debug adapter functions correctly across different platforms and environments. The test suite covers the complete lifecycle from Python environment discovery through adapter initialization and state management.

## Key Components and Relationships

The test suite is organized into three complementary layers:

**Package Integration Tests (`python-adapter.test.ts`)**
- Smoke tests validating the package's public API exports
- Ensures `PythonAdapterFactory`, `PythonDebugAdapter`, and `findPythonExecutable` are properly accessible
- Lightweight verification without complex setup requirements

**Unit Test Suite (`unit/` directory)**
- **Python Discovery Layer** (`python-utils.*.test.ts`) - Tests cross-platform Python executable discovery, version validation, and debugpy availability
- **Factory Layer** (`python-adapter-factory.test.ts`) - Tests factory pattern implementation, environment validation, and adapter creation
- **Adapter Layer** (`python-debug-adapter.spec.ts`) - Tests adapter lifecycle, state management, and event handling

## Test Architecture and Data Flow

The testing strategy follows a bottom-up validation approach:

1. **Foundation**: Python discovery utilities ensure reliable Python environment detection
2. **Factory**: Environment validation feeds into adapter factory creation logic  
3. **Adapter**: Factory-created adapters are tested for proper initialization and lifecycle management
4. **Integration**: Package-level smoke tests verify the complete export surface

## Key Testing Patterns

**Mock-Driven Testing Infrastructure:**
- Comprehensive subprocess mocking via `child_process.spawn` simulation
- File system and platform-specific behavior mocking
- Shared helper functions (`createDependencies()`, `simulateSpawn()`) for consistent test setup

**Cross-Platform Validation:**
- Windows Store Python handling and `.exe` extension logic
- Unix-like system PATH resolution and `python3` vs `python` preference
- Environment variable precedence testing (`PYTHON_EXECUTABLE`, `PythonLocation`, etc.)

**Error Boundary Coverage:**
- Python version requirement validation (≥3.7)
- Missing debugpy package scenarios
- Command execution failures and timeout handling
- CI environment compatibility testing

## Public API Validation

The tests ensure these key entry points function correctly:

- **`PythonAdapterFactory`**: Factory class for creating Python debug adapters with environment validation
- **`PythonDebugAdapter`**: Main adapter class managing debug session lifecycle and state transitions
- **`findPythonExecutable`**: Utility function for cross-platform Python discovery

## Internal Organization

**Test Isolation Strategy:**
- Each test file maintains independent mock setups with consistent beforeEach/afterEach cleanup
- Platform-specific test cases ensure behavior consistency across Windows, macOS, and Linux
- Subprocess simulation enables deterministic testing of external Python environment interactions

**Integration Points:**
- Tests validate integration with `@debugmcp/shared` types and enums
- Node.js built-in module integration (child_process, fs, path, events)
- Logger integration for debugging and error reporting validation

## Critical Validation Areas

The test suite ensures robust Python environment detection with graceful degradation, proper error reporting for development environment issues, and reliable adapter state management for debugging sessions. Special emphasis on CI environment compatibility and comprehensive error scenario coverage ensures the adapter works reliably in diverse deployment environments.