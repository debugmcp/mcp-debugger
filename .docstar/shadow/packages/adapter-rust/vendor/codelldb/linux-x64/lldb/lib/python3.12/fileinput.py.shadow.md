# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/fileinput.py
@source-hash: b0cd2a3f01c96f59
@generated: 2026-02-09T18:09:46Z

## fileinput.py - Multi-File Iterator Module

**Primary Purpose**: Provides a convenient way to iterate over lines from multiple input files or stdin, with optional in-place editing capabilities. Acts as a unified interface for processing file sequences commonly specified via command-line arguments.

### Core Architecture
- **Global State Pattern**: Uses singleton `_state` variable (L76) to maintain active FileInput instance
- **Iterator Protocol**: Implements both function-based API and class-based iteration
- **In-place Editing**: Supports file modification by redirecting stdout to input file location

### Key Classes & Functions

**FileInput Class (L171-398)**
- Main implementation providing file iteration with state tracking
- Constructor (L184-229): Handles file list normalization, mode validation, encoding warnings
- Iterator methods: `__iter__()` (L246), `__next__()` (L249-258) for protocol compliance
- Context manager: `__enter__()` (L240), `__exit__()` (L243) for resource management

**Module-Level Functions (L78-169)**
- `input()` (L78-91): Factory function creating FileInput instance, enforces single active instance
- State accessors: `filename()` (L115), `lineno()` (L124), `filelineno()` (L134), `fileno()` (L144)
- Control functions: `nextfile()` (L101), `close()` (L93), `isfirstline()` (L153), `isstdin()` (L162)

**Utility Hooks (L401-423)**
- `hook_compressed()` (L401-417): Opens .gz/.bz2 files transparently
- `hook_encoded()` (L420-423): Creates encoding-aware file opener

### Critical Implementation Details

**File Processing Logic (L301-372)**
- `_readline()` method handles file switching, stdin detection, in-place setup
- Dynamic method replacement: `self._readline = self._file.readline` (L371) for performance
- In-place mode (L329-358): Creates backup, redirects stdout, preserves permissions

**State Management**
- Line tracking: `_startlineno` + `_filelineno` for cumulative numbering (L378)
- File lifecycle: Automatic cleanup in `nextfile()` (L260-288) with exception safety
- Stdin handling: Special case for '-' filename, binary mode support (L321-327)

### Dependencies
- **Standard Library**: `io`, `sys`, `os` for file operations
- **Optional**: `gzip`, `bz2` for compressed file support (imported on demand)
- **Type System**: `types.GenericAlias` for generic type support (L398)

### Architectural Constraints
- **Single Active Instance**: Only one FileInput can be active globally
- **Sequential Access Only**: Random access not supported, mixing readline() and iteration prohibited
- **Mode Restrictions**: Only 'r' and 'rb' modes allowed (L220-221)
- **In-place Limitations**: Cannot combine with openhook parameter (L225-226)

### Error Handling Patterns
- RuntimeError for invalid state access (multiple locations)
- OSError propagation for file I/O failures
- Graceful cleanup with try/finally blocks (L268-286)
- Silent failure for backup file deletion (L285-286)