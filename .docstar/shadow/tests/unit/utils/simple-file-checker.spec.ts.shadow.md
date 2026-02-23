# tests\unit\utils\simple-file-checker.spec.ts
@source-hash: 08d6d896cd5c3ccb
@generated: 2026-02-23T15:25:59Z

## Primary Purpose
Comprehensive unit tests for the `SimpleFileChecker` utility class, validating file existence checking behavior in both host and container environments with path manipulation logic.

## Test Structure & Dependencies
- Uses Vitest testing framework (L4)
- Tests `SimpleFileChecker` class and `createSimpleFileChecker` factory from `../../../src/utils/simple-file-checker.js` (L5)
- Mocks `IFileSystem` and `IEnvironment` interfaces from external dependencies (L6)
- Sets up comprehensive mocks for file system operations and environment variables (L14-48)

## Key Test Suites

### Host Mode Tests (L50-115)
- **File Existence Check (L56-69)**: Validates basic file existence checking without path manipulation
- **Non-existent Files (L71-83)**: Tests handling of missing files
- **System Errors (L85-99)**: Validates error handling for file system failures (permission denied)
- **Relative Path Rejection (L101-114)**: Ensures relative paths are rejected with helpful error messages

### Container Mode Tests (L117-172)
- **Workspace Prefixing (L127-140)**: Tests automatic `/workspace/` prefix for relative paths in container mode
- **Idempotent Behavior (L142-155)**: Ensures paths already under workspace root aren't double-prefixed
- **Path Format Agnostic (L157-171)**: Validates simple prefix approach without path interpretation (including Windows-style paths)

### Factory Function Test (L174-179)
- Validates `createSimpleFileChecker` factory returns proper instance

## Mock Setup Pattern
Comprehensive mock objects created for:
- **File System (L16-32)**: All file operations with proper TypeScript typing
- **Environment (L34-39)**: Environment variable access and working directory
- **Logger (L41-44)**: Debug logging functionality

## Critical Test Scenarios
- Container mode detection via `MCP_CONTAINER` environment variable (L121)
- Workspace root configuration via `MCP_WORKSPACE_ROOT` (L122)
- Error propagation with descriptive messages
- Path validation and transformation logic
- Hands-off approach to path interpretation (no Windows/Unix path conversion)