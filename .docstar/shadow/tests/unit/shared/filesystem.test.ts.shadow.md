# tests/unit/shared/filesystem.test.ts
@source-hash: 99d0b1e6662ee880
@generated: 2026-02-09T18:14:42Z

## Purpose
Unit tests for the filesystem abstraction layer, validating NodeFileSystem implementation and the global filesystem instance management.

## Test Structure
- **Main Test Suite** (L10-53): Tests NodeFileSystem class functionality and global filesystem configuration
- **Test Setup** (L11-13): Mock restoration after each test using vitest

## Key Test Cases

### NodeFileSystem Delegation (L15-22)
Tests that NodeFileSystem properly delegates `existsSync` and `readFileSync` to Node.js fs module:
- Creates NodeFileSystem instance (L16)
- Uses real package.json as test fixture (L17)
- Validates file existence and content reading

### Error Handling (L24-38)
Verifies safe fallback behavior when fs operations throw:
- Mocks fs methods to throw errors (L27-34)
- Confirms `existsSync` returns `false` on error (L36)
- Confirms `readFileSync` returns empty string on error (L37)

### Global Filesystem Override (L40-52)
Tests the global filesystem instance management:
- Creates mock filesystem stub (L41-44)
- Uses `setDefaultFileSystem` to override global instance (L46)
- Validates `getDefaultFileSystem` returns the stub (L47-48)
- Resets to real implementation for test isolation (L51)

## Dependencies
- **vitest**: Test framework and mocking utilities
- **fs, path**: Node.js standard modules for test fixtures
- **filesystem.js**: Target module providing NodeFileSystem and global management functions

## Testing Patterns
- Uses real files (package.json) for integration-style validation
- Employs type casting for internal property access during mocking
- Implements proper test cleanup to prevent cross-test interference