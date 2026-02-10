# tests/unit/cli/check-rust-binary.test.ts
@source-hash: c69402c2b2420ccd
@generated: 2026-02-10T01:18:54Z

**Purpose:** Unit tests for the `handleCheckRustBinaryCommand` CLI function, validating binary analysis capabilities with comprehensive mocking and output verification.

**Primary Components:**

- **Mock Setup (L3-20):** Creates mocked dependencies for `fs.promises.stat` and `@debugmcp/adapter-rust.detectBinaryFormat` using Vitest's module mocking system
- **Output Capture (L24-41):** Intercepts stdout/stderr writes for assertion verification, with proper cleanup in `afterAll`
- **Test Subject Import (L22):** Dynamically imports the command handler after mocks are established

**Test Coverage:**

- **Input Validation (L44-46):** Verifies empty path rejection with appropriate error message
- **File System Error Handling (L48-53):** Tests stat error propagation and stderr reporting
- **Path Type Validation (L55-62):** Ensures non-file paths are rejected
- **JSON Output Mode (L64-81):** Validates binary analysis with JSON formatting for GNU/DWARF binaries
- **Human-Readable Output (L83-101):** Tests formatted output for MSVC/PDB binaries with platform-specific messaging

**Key Dependencies:**
- `vitest` testing framework with mock capabilities
- `fs.promises.stat` for file system operations
- `@debugmcp/adapter-rust` for binary format detection
- CLI command handler from `../../../src/cli/commands/check-rust-binary.js`

**Testing Patterns:**
- Mock isolation with `beforeEach` reset (L29-36)
- Process stream interception for output verification
- Async/await error handling with `rejects.toThrow`
- Mock call inspection and output string matching

**Architecture Notes:**
- Uses ES modules with dynamic imports after mock setup
- Separates JSON and human-readable output modes
- Platform-aware binary format handling (GNU vs MSVC)