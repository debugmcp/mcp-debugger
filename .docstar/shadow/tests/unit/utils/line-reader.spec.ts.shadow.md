# tests/unit/utils/line-reader.spec.ts
@source-hash: 58de45aa3cbd8d62
@generated: 2026-02-10T00:41:38Z

## Purpose
Comprehensive unit test suite for the LineReader utility class, testing file reading, line context extraction, caching behavior, and error handling capabilities.

## Test Structure
- **Test setup (L28-41)**: Creates mock filesystem and logger dependencies using Vitest mocking
- **Mock factory (L10-26)**: `createMockFileSystem()` provides complete IFileSystem mock implementation with all required methods

## Core Test Suites

### getLineContext Tests (L43-203)
Tests the primary line reading functionality:
- **Basic line context (L44-68)**: Validates extraction of specific line with surrounding context lines
- **Edge cases (L70-106)**: Tests behavior at file start/end boundaries
- **Range validation (L108-122)**: Ensures null return for out-of-bounds line numbers
- **Binary detection (L124-137)**: Verifies rejection of files containing null bytes
- **Size limits (L139-149)**: Tests 10MB file size limit enforcement
- **Caching behavior (L151-172)**: Validates file content caching between reads
- **Empty files (L174-185)**: Handles zero-byte files gracefully
- **Line endings (L187-202)**: Correctly processes Windows CRLF line endings

### getMultiLineContext Tests (L205-240)
Tests multi-line range extraction:
- **Range extraction (L206-223)**: Returns array of lines within specified range
- **Boundary handling (L225-239)**: Clips to available lines when range exceeds file

### Cache Management Tests (L242-272)
- **Cache clearing (L243-263)**: Validates `clearCache()` forces filesystem re-reads
- **Statistics (L265-271)**: Tests `getCacheStats()` returns size and item count metrics

### Error Handling Tests (L274-297)
- **File access errors (L275-281)**: Graceful handling of missing files
- **Stat failures (L283-296)**: Continues operation when file stat operations fail

## Key Dependencies
- **LineReader class**: Main utility under test from `../../../src/utils/line-reader.js`
- **IFileSystem interface**: Abstracted filesystem operations from external dependencies
- **Vitest framework**: Test runner with mocking capabilities

## Testing Patterns
- Mock filesystem responses control test scenarios
- Consistent use of `vi.mocked()` for type-safe mock assertions
- Test isolation via `beforeEach`/`afterEach` mock cleanup
- Comprehensive edge case coverage for file boundaries and error conditions