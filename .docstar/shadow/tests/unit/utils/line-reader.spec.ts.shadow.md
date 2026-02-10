# tests/unit/utils/line-reader.spec.ts
@source-hash: 58de45aa3cbd8d62
@generated: 2026-02-09T18:14:46Z

**Purpose**: Comprehensive unit test suite for the LineReader utility class, testing file reading, line context extraction, caching, and error handling behaviors.

**Test Structure**:
- Main test suite for `LineReader` (L28-298)
- Mock filesystem factory `createMockFileSystem()` (L10-26) creates complete IFileSystem mock with all required methods
- Test setup with `beforeEach()` (L33-37) initializes fresh mocks and LineReader instance
- Test cleanup with `afterEach()` (L39-41) clears all mocks between tests

**Key Test Categories**:

**getLineContext Tests** (L43-203):
- Basic line context retrieval with surrounding lines (L44-68)
- Edge cases: start of file (L70-87), end of file (L89-106) 
- Error conditions: out of range lines (L108-122), binary files (L124-137), oversized files (L139-149)
- Caching verification - ensures file system called only once for repeated reads (L151-172)
- Empty file handling (L174-185)
- Cross-platform line ending support (Windows CRLF) (L187-202)

**getMultiLineContext Tests** (L205-240):
- Multi-line range extraction (L206-223)
- Out-of-range handling with graceful fallback (L225-239)

**Cache Management Tests** (L242-272):
- Cache clearing functionality verification (L243-263)
- Cache statistics reporting (L265-271)

**Error Handling Tests** (L274-297):
- File system errors during stat operations (L275-281)
- Partial failure scenarios during binary detection (L283-296)

**Key Dependencies**:
- `vitest` for testing framework and mocking
- `LineReader` and `createLineReader` from source module
- `IFileSystem` interface for file operations abstraction
- Node.js `fs.Stats` for file metadata mocking

**Test Patterns**:
- Extensive use of `vi.mocked()` for type-safe mock assertions
- Mock file content setup with realistic multi-line scenarios
- Consistent pattern of stat + readFile mock configuration
- Verification of both positive and negative test cases
- Cache behavior validation through call count assertions

**Coverage Focus**:
- Line boundary conditions and context window calculation
- Binary file detection and rejection
- File size limits (10MB threshold implied from 11MB test)
- Cross-platform compatibility (line endings)
- Performance optimization through caching
- Graceful error handling without throwing exceptions