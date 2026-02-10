# packages/adapter-rust/tests/rust-adapter.test.ts
@source-hash: cef19ba59fa0e0de
@generated: 2026-02-10T00:41:27Z

**Primary Purpose**: Comprehensive test suite for Rust debug adapter implementation, validating functionality of `RustDebugAdapter` and `RustAdapterFactory` classes through unit tests with mocked dependencies.

**Core Test Structure**:
- Test setup with comprehensive mock dependencies (L18-50) including fileSystem, logger, environment, and processLauncher
- Main test suites: `RustDebugAdapter` (L52-248) and `RustAdapterFactory` (L250-282)

**Key Test Categories**:

**Basic Properties Tests (L60-70)**:
- Validates adapter language identification as `DebugLanguage.RUST`
- Verifies initial state as `AdapterState.UNINITIALIZED`
- Confirms adapter name and readiness status

**Capabilities Tests (L72-96)**:
- Tests supported debug features (conditional breakpoints, function breakpoints, data breakpoints, disassemble request, log points)
- Validates unsupported features (reverse debugging/step back)
- Verifies comprehensive capabilities object structure

**Command Building Tests (L98-170)**:
- Tests `buildAdapterCommand()` with TCP mode configuration
- Validates CodeLLDB executable resolution and command construction
- Tests error handling for missing CodeLLDB executable and invalid ports
- Platform-specific environment variable handling (Windows PDB reader)

**Launch Config Transformation Tests (L172-221)**:
- Tests `transformLaunchConfig()` with explicit program paths
- Validates Cargo-specific configuration handling (bin, release, build flags)
- Tests error cases for missing program specification
- Verifies LLDB protocol transformation

**Connection Management Tests (L223-235)**:
- Validates connect/disconnect lifecycle
- Tests state transitions between CONNECTED/DISCONNECTED states

**Error Translation Tests (L237-247)**:
- Tests `translateErrorMessage()` for CodeLLDB and Cargo-specific errors
- Validates helpful error message generation

**Factory Tests (L250-282)**:
- Tests `RustAdapterFactory.createAdapter()` with dependency injection
- Validates factory metadata (language, display name, file extensions)
- Tests environment validation functionality

**Key Dependencies**:
- Vitest testing framework for mocking and assertions
- `@debugmcp/shared` types (AdapterState, DebugLanguage, DebugFeature, etc.)
- Core adapter classes from `../src/` modules

**Testing Patterns**:
- Extensive use of Vitest mocks (`vi.fn()`, `vi.spyOn()`)
- Mock restoration pattern in test cleanup
- Type casting for testing private methods
- Platform-specific conditional testing (Windows vs Unix)