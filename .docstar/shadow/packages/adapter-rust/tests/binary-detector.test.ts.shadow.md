# packages/adapter-rust/tests/binary-detector.test.ts
@source-hash: 55506f3edd47d545
@generated: 2026-02-09T18:14:33Z

## Primary Purpose
Test suite for binary format detection functionality in the adapter-rust package. Validates the `detectBinaryFormat` utility's ability to identify MSVC vs GNU binary formats and extract debug information characteristics.

## Key Functions

**createTempDir() (L9-11)**: Creates temporary directories for test isolation using OS temp directory with consistent prefix.

**writeBinary() (L13-17)**: Helper to write binary content (Buffer or string) to files within test directories, returning the full file path.

## Test Structure

**Global cleanup (L19-35)**: 
- Maintains `tempDirs` array for tracking created directories
- `afterEach` hook ensures complete cleanup of temporary files and directories
- Robust error handling prevents test failures due to cleanup issues

**Main test suite (L37-97)**:

### MSVC Binary Detection (L38-61)
- Creates synthetic binary with MSVC signatures: "MZ" header, "RSDS" debug signature
- Includes mock imports: "vcruntime140.dll", "ucrtbase.dll" 
- Creates companion PDB file to test debug info detection
- Validates: `hasPDB=true`, `hasRSDS=true`, imports extraction, `debugInfoType='pdb'`, `format='msvc'`

### GNU Binary Detection (L63-83)
- Creates binary with DWARF debug hints: ".debug_info" section marker
- Includes "msvcrt.dll" import for testing cross-format scenarios
- Validates: `hasPDB=false`, `hasRSDS=false`, imports extraction, `debugInfoType='dwarf'`, `format='gnu'`

### Unknown Binary Handling (L85-96)
- Tests graceful handling of unrecognizable binary formats
- Validates fallback behavior: `format='unknown'`, no debug info detected

## Dependencies
- **vitest**: Test framework (describe, it, expect, afterEach)
- **Node.js built-ins**: fs/promises, os, path for file system operations
- **../src/utils/binary-detector.js**: Core detection utility being tested

## Test Data Patterns
Uses synthetic binary data with recognizable signatures rather than real binaries for predictable, lightweight testing. Mock data includes format-specific markers (RSDS, DWARF sections) and import lists for comprehensive validation.