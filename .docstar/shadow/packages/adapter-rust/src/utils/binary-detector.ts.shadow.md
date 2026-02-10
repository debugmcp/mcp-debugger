# packages/adapter-rust/src/utils/binary-detector.ts
@source-hash: 90e21bd7d61a24ee
@generated: 2026-02-09T18:14:05Z

## Purpose
Binary format detection utility for Rust executables, designed to classify Windows PE binaries as MSVC or GNU-compiled and identify debug information availability.

## Core Interface
**BinaryInfo (L4-10)**: Result interface containing:
- `format`: Binary classification ('msvc' | 'gnu' | 'unknown')
- `hasPDB`: External .pdb file presence
- `hasRSDS`: RSDS debug signature in binary
- `imports`: Detected DLL imports
- `debugInfoType`: Debug format classification ('pdb' | 'dwarf' | 'none')

## Main Function
**detectBinaryFormat(exePath) (L64-110)**: Async function that analyzes a binary file:
1. Checks file existence and reads first 1MB (MAX_SCAN_BYTES)
2. Scans for companion .pdb file in same directory
3. Searches binary content for RSDS signature and import patterns
4. Returns comprehensive BinaryInfo object

## Classification Logic
**classifyFormat() (L48-62)**: Determines binary format based on:
- MSVC indicators: vcruntime140.dll, ucrtbase.dll, msvcp140.dll imports
- GNU indicators: msvcrt.dll, libstdc++, libgcc imports or DWARF debug info
- Falls back to 'unknown' if no clear pattern

**detectDebugInfo() (L35-46)**: Prioritizes PDB over DWARF detection:
- Returns 'pdb' if .pdb file or RSDS signature found
- Returns 'dwarf' if DWARF hints detected in binary content
- Defaults to 'none'

## Utility Functions
**bufferContains() (L18-20)**: Simple binary pattern matching
**collectImports() (L22-33)**: Extracts known DLL imports from ASCII representation

## Constants
- MAX_SCAN_BYTES (L12): 1MB scan limit for performance
- RSDS_SIGNATURE (L13): Microsoft debug signature
- MSVC_IMPORTS/GNU_IMPORTS (L15-16): Toolchain identification patterns
- DWARF_HINTS (L14): DWARF debug format indicators

## Error Handling
Gracefully handles file access errors and returns default BinaryInfo with 'unknown'/'none' values. Uses try-catch blocks around file operations.