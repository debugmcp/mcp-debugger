# tests\integration\rust\rust-integration.test.ts
@source-hash: 5221791c32095f4f
@generated: 2026-02-19T23:47:41Z

**Purpose**: Integration test suite for the Rust debugging adapter, verifying session creation, breakpoint management, and session lifecycle for Rust projects using the DebugMCP framework.

**Test Structure**:
- **Main test suite** (L11-85): `Rust Adapter Integration` using Vitest framework
- **Setup/teardown**: `beforeAll` (L15-30) initializes SessionManager with temp directories and debug logging; `afterAll` (L32-34) cleans up all sessions
- **Session lifecycle tests**: Create session (L36-47), verify Cargo project handling (L49-56), test breakpoints (L58-76), close session (L78-84)

**Key Dependencies**:
- `SessionManager` from `../../../src/session/session-manager.js` - Core debugging session management
- `createProductionDependencies` from `../../../src/container/dependencies.js` - Dependency injection setup
- `DebugLanguage.RUST` from `@debugmcp/shared` - Language constant for Rust debugging
- Standard Node.js modules: `path`, `os` for temp directory handling

**Test Configuration**:
- Uses temporary directories for logs and session data to avoid filesystem conflicts
- Enables debug logging with custom log file location
- Configures DAP launch args with `stopOnEntry: true` and `justMyCode: true`

**Notable Patterns**:
- **Graceful degradation**: Breakpoint test (L63-75) uses try-catch to handle missing test files without failing the suite
- **Session state tracking**: Stores `sessionId` (L13, 46) for cross-test session manipulation
- **Example project reference**: Uses hardcoded path `examples/rust/hello_world/src/main.rs` for breakpoint testing

**Test Verification Points**:
- Session creation with correct language and name assignment
- Session retrieval and persistence across test methods
- Breakpoint setting with verification status (when test files available)
- Proper session cleanup and removal from manager

**Architectural Notes**:
- Tests focus on adapter integration rather than full Rust debugging workflow
- Designed to work with or without compiled Rust binaries present
- Uses production dependencies in test environment for realistic integration testing