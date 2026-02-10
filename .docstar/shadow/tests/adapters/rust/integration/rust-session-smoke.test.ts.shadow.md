# tests/adapters/rust/integration/rust-session-smoke.test.ts
@source-hash: 68665fc60213f9f4
@generated: 2026-02-09T18:14:15Z

## Primary Purpose
Integration test file for the Rust adapter's session management functionality. Tests command building and launch configuration transformation without actual process execution.

## Key Components

### Dependencies & Setup (L1-7)
- Uses Vitest testing framework
- Imports RustAdapterFactory from adapter-rust package
- Imports AdapterDependencies type for dependency injection

### Mock Dependencies Factory (L8-42)
`createDependencies()` - Creates mock AdapterDependencies object with:
- Stubbed file system operations (all return empty/false values)
- No-op logger methods
- Real environment access via process.env
- Process launcher that throws error to prevent actual process spawning (L38-40)

### Test Suite Configuration (L44-74)
Constants for test environment:
- `adapterPort: 48765` - TCP port for adapter communication
- `sessionId: 'session-rust-smoke'` - Test session identifier  
- `sampleScriptPath` - Points to examples/rust/src/main.rs
- `fakeCodelldbPath` - Uses process.execPath as mock CodeLLDB path

Environment variable management:
- `beforeEach()` (L55-60) - Sets CODELLDB_PATH, clears RUST_BACKTRACE
- `afterEach()` (L62-74) - Restores original environment variables

### Test Cases

#### Command Building Test (L76-104)
Tests `adapter.buildAdapterCommand()` with mock parameters:
- Verifies command path is absolute and exists
- Checks TCP port arguments (--port flag)
- Validates --liblldb argument presence
- Confirms RUST_BACKTRACE=1 environment variable
- Platform-specific LLDB_USE_NATIVE_PDB_READER validation (Windows only)

#### Launch Configuration Test (L106-125)  
Tests `adapter.transformLaunchConfig()` for Rust binary debugging:
- Uses examples/rust-hello project with platform-specific binary name
- Validates transformation to LLDB launch configuration
- Confirms absolute path resolution for program executable
- Verifies sourceLanguages=['rust'] and console='internalConsole' settings

## Architectural Patterns
- Dependency injection pattern with mock implementations
- Environment variable isolation for test reliability  
- Platform-specific handling for Windows vs Unix systems
- Integration testing without external process dependencies

## Critical Constraints
- Process launcher must throw error to prevent actual process execution
- Tests depend on existence of example Rust projects in workspace
- CodeLLDB path validation requires executable file existence