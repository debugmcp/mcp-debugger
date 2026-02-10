# packages/adapter-rust/tests/binary-detector.test.ts
@source-hash: 55506f3edd47d545
@generated: 2026-02-10T00:41:25Z

**Primary Purpose**: Test suite for binary format detection utility in a Rust adapter package. Tests the `detectBinaryFormat` function's ability to distinguish between MSVC and GNU compiler outputs based on binary signatures and debug information.

**Key Test Utilities**:
- `createTempDir()` (L9-11): Creates temporary directories using OS temp folder with prefixed naming
- `writeBinary()` (L13-17): Writes binary content (Buffer or string) to files in specified directory
- `tempDirs` array (L19): Tracks temporary directories for cleanup
- `afterEach` cleanup hook (L21-35): Removes all temporary directories and files after each test

**Test Coverage**:
- **MSVC Binary Detection** (L38-61): Tests detection of MSVC-compiled binaries via:
  - RSDS signature presence (`hasRSDS: true`)
  - PDB file existence (`hasPDB: true`) 
  - DLL import extraction (`vcruntime140.dll`, `ucrtbase.dll`)
  - Debug info type classification (`debugInfoType: 'pdb'`)
  - Format classification (`format: 'msvc'`)

- **GNU Binary Detection** (L63-83): Tests detection of GNU-compiled binaries via:
  - DWARF debug section hints (`.debug_info` string)
  - Absence of RSDS/PDB markers
  - DLL import parsing (`msvcrt.dll`)
  - Debug info type classification (`debugInfoType: 'dwarf'`)
  - Format classification (`format: 'gnu'`)

- **Unknown Binary Handling** (L85-96): Tests graceful degradation for unrecognized binary formats with safe defaults

**Dependencies**:
- `detectBinaryFormat` from `../src/utils/binary-detector.js` - core function under test
- Vitest testing framework for test structure and assertions
- Node.js filesystem APIs for temp file management

**Test Data Pattern**: Uses synthetic binary data with embedded signatures (`MZ` PE header, `RSDS` debug signature, `.debug_info` DWARF marker) and DLL import strings to simulate real compiler outputs without requiring actual compiled binaries.

**Architecture Notes**: 
- Follows isolated test pattern with proper cleanup to prevent test pollution
- Uses Buffer construction to create controlled binary test data
- Tests both positive detection cases and graceful failure handling