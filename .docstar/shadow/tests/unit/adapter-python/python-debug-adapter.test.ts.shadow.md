# tests/unit/adapter-python/python-debug-adapter.test.ts
@source-hash: 680b31f600fe78f8
@generated: 2026-02-09T18:14:51Z

## Python Debug Adapter Test Suite

**Purpose:** Comprehensive unit test suite for `PythonDebugAdapter` class, validating Python-specific debugging functionality including environment validation, executable resolution, debugpy integration, and DAP protocol handling.

### Test Structure & Dependencies (L1-30)
- **Framework:** Vitest with mocking capabilities
- **Mocked modules:** `child_process` (L6-9), `python-utils.js` (L11-14)  
- **Helper:** `createDependencies()` (L19-30) - creates mock dependency objects with logger, fileSystem, environment, processLauncher
- **Imports:** PythonDebugAdapter, shared types (AdapterState, AdapterError, DebugFeature)

### Core Functionality Tests

**Executable Resolution & Caching (L37-47)**
- Validates caching mechanism for `resolveExecutablePath()` 
- Ensures `findPythonExecutable` called only once despite multiple calls

**Environment Validation (L49-85)**
- **Python version validation** (L49-60): Tests rejection of Python < 3.7
- **Debugpy detection** (L62-75): Validates debugpy installation checking with virtual environment detection
- **Executable resolution failure** (L77-85): Handles Python executable not found scenarios

**Version Caching System (L87-96)**
- Tests internal `pythonPathCache` Map usage for storing version information
- Validates cache hits prevent redundant `getPythonVersion` calls

### Command Building & DAP Protocol (L98-141)

**Adapter Command Generation (L98-113)**
- Tests `buildAdapterCommand()` with debugpy-specific arguments
- Validates environment variable setup (`DEBUGPY_LOG_DIR`)

**DAP Request Handling (L115-129)**
- Exception filter validation (rejects invalid filters, allows 'raised'/'uncaught')
- Tests `sendDapRequest()` with exception breakpoint management

**Event Processing (L131-141)**
- Tests `handleDapEvent()` for 'stopped' events
- Validates thread ID tracking via `getCurrentThreadId()`

### Feature Support & Requirements (L143-178)
- **Feature detection:** `supportsFeature()` for LOG_POINTS (true), DISASSEMBLE_REQUEST (false)
- **Requirements mapping:** `getFeatureRequirements()` returns version/dependency requirements
- **Error translation:** `translateErrorMessage()` for debugpy-specific and common Python errors

### Lifecycle Management (L180-224)

**Initialization (L180-206)**
- Tests successful initialization with environment validation
- Error handling when validation fails (throws AdapterError, sets ERROR state)

**Connection Management (L208-224)**
- State transitions: CONNECTED → DISCONNECTED
- Event emission: 'connected', 'disconnected' events
- Connection status tracking via `isConnected()`

### Advanced Features (L226-322)

**Debugpy Detection (L226-260)**
- Spawn-based detection using `python -c "import debugpy; print(debugpy.__version__)"`
- Error handling for spawn failures

**Configuration Management (L262-278)**
- `transformLaunchConfig()` applies Python-specific defaults
- Sets console, redirectOutput, showReturnValue, etc.

**Cleanup & Metadata (L280-322)**
- **Disposal** (L280-292): State reset, event emission, cleanup
- **Capabilities** (L294-305): DAP capabilities and exception breakpoint filters
- **User guidance** (L307-312): Installation instructions, error messages
- **Default configuration** (L314-322): Provides sensible launch config defaults

### Key Patterns
- Extensive use of private method mocking via `(adapter as any)` casting
- Event-driven testing with EventEmitter patterns
- Mock-heavy approach for external dependencies (child_process, file system)
- Comprehensive state management validation
- Error scenario coverage with specific error codes