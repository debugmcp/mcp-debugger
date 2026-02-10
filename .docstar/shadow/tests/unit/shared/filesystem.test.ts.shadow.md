# tests/unit/shared/filesystem.test.ts
@source-hash: 99d0b1e6662ee880
@generated: 2026-02-10T00:41:33Z

## Purpose
Unit tests for the NodeFileSystem implementation and default filesystem management functionality. Tests filesystem abstraction layer that provides safe defaults when underlying Node.js fs operations fail.

## Test Structure
- **Main test suite** (L10-53): "NodeFileSystem" - Tests the NodeFileSystem class behavior
- **Setup/Teardown** (L11-13): Restores all Vitest mocks after each test

## Key Test Cases

### Basic Delegation Test (L15-22)
Tests that NodeFileSystem properly delegates to Node.js fs module:
- Creates NodeFileSystem instance (L16)
- Uses real package.json as test fixture (L17)
- Verifies existsSync returns true for existing file (L19)
- Verifies readFileSync returns content containing expected JSON property (L20-21)

### Error Handling Test (L24-38)
Tests safe defaults when fs operations throw errors:
- Mocks fs methods to throw errors (L27-34)
- Uses type assertion to access private fs property (L27)
- Verifies existsSync returns false on error (L36)
- Verifies readFileSync returns empty string on error (L37)

### Default Filesystem Override Test (L40-52)
Tests the global filesystem instance management:
- Creates stub filesystem with mocked methods (L41-44)
- Tests setDefaultFileSystem() and getDefaultFileSystem() functions (L46-48)
- Resets to real implementation to prevent test pollution (L50-51)

## Dependencies
- **Vitest**: Testing framework with mocking capabilities
- **Node.js fs/path**: Standard filesystem modules
- **../../../packages/shared/src/interfaces/filesystem.js**: Source module under test

## Key Patterns
- Uses real filesystem operations for integration-style testing
- Employs type assertions to access private members for error simulation
- Includes explicit cleanup to prevent cross-test contamination
- Tests both happy path and error scenarios for robust coverage