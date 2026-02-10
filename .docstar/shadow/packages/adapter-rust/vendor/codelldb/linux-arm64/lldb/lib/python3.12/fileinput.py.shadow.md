# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/fileinput.py
@source-hash: b0cd2a3f01c96f59
@generated: 2026-02-09T18:08:49Z

## Purpose and Responsibility
Python's `fileinput` module provides utilities for iterating over lines from multiple input files or stdin, with support for in-place editing and custom file opening hooks. Core functionality centers around sequential line-by-line processing with state tracking.

## Key Classes and Functions

### FileInput Class (L171-398)
Primary implementation class that handles file iteration and state management.

**Constructor** (L184-229):
- Accepts files, inplace editing, backup options, mode, encoding, and openhook parameters
- Normalizes file inputs (string, PathLike, or list) to tuple format
- Defaults to sys.argv[1:] if no files provided, or ('-',) for stdin
- Validates mode parameter (must be 'r' or 'rb')
- Handles encoding warnings when encoding not specified

**Core Methods**:
- `__next__()` (L249-258): Iterator protocol implementation with automatic file advancement
- `_readline()` (L301-372): Core file opening and reading logic, handles stdin, inplace editing, and custom hooks
- `nextfile()` (L260-288): Closes current file and advances to next, manages stdout redirection cleanup
- `readline()` (L290-299): Alternative to iterator interface for line reading

**State Query Methods**:
- `filename()` (L374): Returns current filename or '<stdin>'
- `lineno()` (L377): Returns cumulative line number across all files
- `filelineno()` (L380): Returns line number within current file
- `isfirstline()` (L392): Checks if current line is first in its file
- `isstdin()` (L395): Checks if reading from stdin

### Module-Level Functions
Global state management functions that delegate to a singleton FileInput instance stored in `_state` (L76).

**Primary Interface**:
- `input()` (L78-91): Creates and returns FileInput instance, enforces single active instance
- `close()` (L93-99): Closes active FileInput and resets global state

**State Query Functions** (L101-169): 
All check for active `_state` and delegate to corresponding FileInput methods:
- `nextfile()`, `filename()`, `lineno()`, `filelineno()`, `fileno()`, `isfirstline()`, `isstdin()`

### Utility Functions
- `hook_compressed()` (L401-417): Opens gzip/bz2 files with automatic decompression
- `hook_encoded()` (L420-423): Returns closure for opening files with specific encoding
- `_test()` (L426-439): Command-line testing function with getopt argument parsing

## Key Dependencies and Relationships
- **Standard Library**: `io`, `sys`, `os`, `types.GenericAlias`
- **Optional Imports**: `gzip`, `bz2` (loaded dynamically in hook_compressed)
- **Global State Pattern**: Single `_state` variable maintains active FileInput instance

## Important Architectural Decisions

### In-Place Editing (L329-358)
When `inplace=True`:
1. Original file renamed to backup (with .bak extension by default)
2. Original filename opened for writing, stdout redirected to it
3. Reading occurs from backup file
4. Backup deleted unless explicit backup extension provided

### File Opening Strategy
- Stdin handling: filename '-' maps to sys.stdin, sets `<stdin>` as display name
- Custom hooks: `openhook` parameter allows custom file opening logic
- Encoding: Defaults to "locale" for text mode, with EncodingWarning when unspecified

### Iterator Protocol
Implements both `__next__()` and `readline()` interfaces, with automatic file advancement when current file exhausted.

## Critical Invariants and Constraints
- Only one active FileInput instance allowed globally (enforced by `input()`)
- Sequential access only - random access not supported
- Mode restricted to 'r' or 'rb' for security
- In-place editing incompatible with custom openhooks
- Backup filename collision handling (existing backups deleted)
- Proper cleanup of stdout redirection and temporary files in exception scenarios