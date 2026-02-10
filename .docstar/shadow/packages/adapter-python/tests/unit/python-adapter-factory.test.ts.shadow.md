# packages/adapter-python/tests/unit/python-adapter-factory.test.ts
@source-hash: 28a0bb6940aeaa3c
@generated: 2026-02-10T00:41:09Z

## Test Suite: PythonAdapterFactory

**Primary Purpose:** Unit tests for `PythonAdapterFactory` class, validating factory pattern implementation, adapter creation, metadata retrieval, and environment validation functionality.

### Key Test Components

**Test Setup & Mocking (L11-26):**
- Mocks `python-utils.js` functions (`findPythonExecutable`, `getPythonVersion`)
- Mocks `child_process.spawn` for simulating Python process execution
- Creates typed mock references for test assertions

**Test Utilities:**
- `createDependencies()` (L28-43): Factory function creating mock `AdapterDependencies` with stubbed logger, environment, fileSystem, and processLauncher
- `simulateSpawn()` (L45-66): Helper simulating child process spawn behavior with configurable output, exit codes, and error conditions

### Test Scenarios

**Factory Functionality (L76-96):**
- Validates adapter instance creation returns `PythonDebugAdapter`
- Verifies metadata structure matches expected Python adapter configuration (language, version, file extensions)

**Environment Validation (L98-173):**
- **Success path (L98-114):** Tests valid environment with Python 3.10.1 and debugpy 1.8.1
- **Python detection failures (L116-124):** Handles missing Python executable
- **Version validation (L126-136):** Rejects Python versions below 3.7 requirement
- **Version detection issues (L138-149):** Gracefully handles undeterminable Python versions with warnings
- **debugpy validation (L151-173):** Detects missing debugpy via exit codes and spawn errors

### Dependencies & Patterns

**External Dependencies:**
- Uses Vitest testing framework with mocking capabilities
- Imports shared types from `@debugmcp/shared` package
- Tests integration with Node.js `child_process` and `events` modules

**Testing Patterns:**
- Comprehensive mock setup with cleanup in `beforeEach` (L69-74)
- Async validation testing with simulated subprocess behavior
- Error boundary testing for various failure scenarios
- Metadata validation ensuring consistent adapter configuration

### Critical Validation Logic
Environment validation tests Python version >= 3.7 requirement and debugpy package availability through subprocess execution simulation, providing comprehensive error reporting and warning mechanisms for development environment issues.