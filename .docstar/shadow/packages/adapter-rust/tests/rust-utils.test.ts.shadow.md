# packages/adapter-rust/tests/rust-utils.test.ts
@source-hash: 5c50520bf39464b1
@generated: 2026-02-09T18:14:34Z

**Purpose**: Comprehensive test suite for rust-utils module functionality, covering Rust toolchain detection, project building, filesystem operations, and dlltool executable discovery.

**Key Test Components**:

- **Mock Setup (L9-22)**: Mocks `child_process.spawn` and `which` module using Vitest for isolated testing
- **createMockProcess (L24-49)**: Factory function creating EventEmitter-based mock processes with configurable stdout/stderr chunks, exit codes, and error conditions
- **Test Utilities (L51-76)**:
  - `createTempDir (L53-57)`: Creates temporary directories with cleanup tracking
  - `overridePlatform (L59-63)`: Platform override helper with restoration capability
  - Setup/teardown hooks for mock resets and temp directory cleanup

**Test Suites**:

1. **Process Checks (L78-149)**:
   - `checkCargoInstallation()` testing (L79-87): Validates cargo detection via spawn success/failure
   - `checkRustInstallation()` testing (L89-97): Validates rustc detection 
   - `getCargoVersion()` testing (L99-109): Version parsing from cargo output with fallback to null
   - `buildRustProject()` testing (L111-134): Build execution with success/failure output capture
   - `getRustHostTriple()` testing (L136-148): Host triple extraction from rustc verbose output

2. **Filesystem Helpers (L151-174)**:
   - `findCargoProjectRoot()` testing (L152-160): Directory traversal to locate Cargo.toml
   - `getRustBinaryPath()` testing (L162-173): Binary resolution with platform-specific extensions

3. **Dlltool Discovery (L176-214)**:
   - Environment variable override testing (L177-184)
   - `which` command fallback testing (L186-189) 
   - Windows-specific rustup toolchain scanning (L191-213): Complex directory structure navigation

**Dependencies**: 
- `vitest` for testing framework
- Node.js built-ins (`fs`, `path`, `os`, `events`) for filesystem operations
- Target module `../src/utils/rust-utils.js`

**Patterns**:
- Extensive mocking of external processes and filesystem
- Temporary directory creation with automatic cleanup
- Platform-specific behavior testing with process.platform override
- Asynchronous process simulation using EventEmitter and queueMicrotask