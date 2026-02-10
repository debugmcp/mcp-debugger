# packages/adapter-rust/src/utils/binary-detector.ts
@source-hash: 90e21bd7d61a24ee
@generated: 2026-02-10T00:41:06Z

## Purpose
Binary format detection utility for Rust binaries, analyzing executable files to determine their compiler toolchain (MSVC vs GNU), debug information presence, and import dependencies.

## Key Interface
- `BinaryInfo` (L4-10): Core data structure containing format classification, debug info flags, and import list
- `detectBinaryFormat()` (L64-110): Main async function that analyzes an executable file and returns comprehensive binary information

## Core Detection Logic
- `bufferContains()` (L18-20): Simple buffer search utility for binary signatures
- `collectImports()` (L22-33): Scans binary content for known DLL imports using ASCII conversion and pattern matching
- `detectDebugInfo()` (L35-46): Determines debug format (PDB/DWARF/none) based on file presence and binary signatures
- `classifyFormat()` (L48-62): Categorizes binary as MSVC/GNU/unknown based on import patterns and debug info

## Detection Strategies
**Format Classification:**
- MSVC: Presence of vcruntime140.dll, ucrtbase.dll, msvcp140.dll imports
- GNU: Presence of msvcrt.dll, libstdc++, libgcc imports or DWARF debug info
- Fallback to 'unknown' if no clear indicators

**Debug Info Detection:**
- PDB: External .pdb file existence or RSDS signature in binary
- DWARF: String patterns '.debug_info' or 'dwarf' in binary content
- None: No debug information detected

## Implementation Details
- Scans first 1MB of binary (MAX_SCAN_BYTES) for performance
- Uses filesystem checks for external PDB files
- ASCII string conversion for import/signature detection
- Graceful error handling returns default empty BinaryInfo on failures

## Dependencies
- Node.js fs/promises for file operations
- path module for file path manipulation
- Buffer operations for binary data processing