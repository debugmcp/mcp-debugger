# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/fileinput.py
@source-hash: b0cd2a3f01c96f59
@generated: 2026-02-09T18:07:08Z

## Primary Purpose
Python's `fileinput` module provides utilities for iterating over lines from multiple files or stdin in sequence. It implements a global state pattern with module-level functions and an underlying `FileInput` class, supporting in-place editing, backup creation, and custom file opening hooks.

## Key Components

### Module-Level API (L78-169)
- `input()` (L78-91): Factory function creating FileInput instance and setting global `_state`
- `close()` (L93-99): Closes current FileInput sequence and clears global state  
- `nextfile()` (L101-113): Skips to next file in sequence
- State query functions: `filename()` (L115-122), `lineno()` (L124-132), `filelineno()` (L134-142), `fileno()` (L144-151), `isfirstline()` (L153-160), `isstdin()` (L162-169)

### Core FileInput Class (L171-398)
- `__init__()` (L184-229): Constructor handling file list normalization, mode validation, and encoding warnings
- Iterator protocol: `__iter__()` (L246-247), `__next__()` (L249-258) 
- Context manager: `__enter__()` (L240-241), `__exit__()` (L243-244)
- `_readline()` (L301-372): Core file opening/switching logic with in-place editing support
- `nextfile()` (L260-288): File cleanup including stdout restoration and backup handling
- State accessors matching module functions (L374-396)

### Utility Hooks (L401-423)
- `hook_compressed()` (L401-417): Opens gzip/bz2 files with automatic decompression
- `hook_encoded()` (L420-423): Returns opener with fixed encoding

## Architecture Patterns

### Global State Singleton
Uses module-level `_state` variable (L76) to maintain single active FileInput instance, enforced by RuntimeError in `input()` (L87-88).

### In-Place Editing Protocol (L329-358)
1. Rename original to backup file
2. Open backup for reading, original for writing  
3. Redirect stdout to output file
4. Restore stdout and cleanup backup on nextfile()

### Lazy File Opening
Files opened only when needed in `_readline()` (L301-372). Method replacement pattern: `self._readline = self._file.readline` (L371) for performance.

## Critical Invariants
- Only one FileInput instance active globally (enforced L87-88)
- Sequential access only - no random access supported
- In-place mode incompatible with openhook (L225-226)
- Mode restricted to 'r' or 'rb' (L220-221)
- Stdin ('-') handling bypasses openhook and inplace logic

## Dependencies
- `io`, `sys`, `os` for file operations
- `types.GenericAlias` for type parameterization (L398)
- Optional `gzip`, `bz2` for compressed file support
- Optional `warnings` for encoding deprecation warnings

## Notable Implementation Details
- Handles PathLike objects via `os.fspath()` (L188-189)
- Special stdin buffer handling for binary mode (L324)
- Preserves file permissions in in-place mode (L341, L354)
- Encoding warning system for Python 3.10+ (L213-217)