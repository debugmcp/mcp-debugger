# packages/adapter-javascript/tests/unit/config-transformer.edge2.test.ts
@source-hash: 54d699504669f384
@generated: 2026-02-09T18:13:59Z

**Purpose**: Unit tests for edge case scenarios in config-transformer utilities, focusing on ESM project detection and TypeScript configuration path handling with mocked filesystem operations.

**Key Components**:
- `MockFileSystem` class (L13-38): Test double implementing FileSystem interface with configurable mocks for `existsSync` and `readFileSync` operations
- Test setup using vitest framework with beforeEach/afterEach hooks (L45-56) for filesystem mock injection and cleanup
- Edge case test suite (L40-103) covering boundary conditions in configuration detection logic

**Dependencies**:
- vitest testing framework (L1)
- Node.js path module (L2) 
- @debugmcp/shared FileSystem interfaces (L3)
- config-transformer utilities under test: `isESMProject`, `hasTsConfigPaths`, `setDefaultFileSystem` (L4-8)

**Test Coverage**:
- `isESMProject` with empty programPath fallback to cwd-only checks (L58-66)
- package.json type field validation for non-"module" values (L68-76)
- tsconfig.json module field validation for CommonJS configuration (L78-86)
- `hasTsConfigPaths` handling of non-object path configurations (L88-103)

**Testing Strategy**:
- Uses dependency injection pattern via `setDefaultFileSystem()` to replace real filesystem with controllable mock
- Mock setup allows precise control over file existence and content responses
- Tests focus on branch-padding edge cases that might not be covered in main test suites
- Proper cleanup ensures test isolation by restoring NodeFileSystem after each test

**Notable Patterns**:
- String coercion with `String(p)` for path comparison in mocks (L60, L70, L80, L92)
- JSON.stringify/parse cycle for configuration file content simulation
- Array treatment as truthy object in paths validation (L98-102) - implementation quirk documented in test