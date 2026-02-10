# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/fileinput.py
@source-hash: b0cd2a3f01c96f59
@generated: 2026-02-09T18:08:28Z

## Core Purpose
Python's `fileinput` module provides utilities for iterating over lines from multiple input files or stdin in a unified manner. Implements both module-level functions and a FileInput class for processing file sequences with optional in-place editing capabilities.

## Key Components

### Global State Management
- `_state` (L76): Global FileInput instance tracking current processing state
- `input()` (L78-91): Factory function creating FileInput instance, enforces single active session
- `close()` (L93-99): Cleanup function resetting global state

### Module-Level Interface Functions (L101-169)
All delegate to global `_state` instance with runtime checks:
- `nextfile()`: Advance to next file in sequence
- `filename()`: Current filename or None before first read
- `lineno()`: Cumulative line number across all files  
- `filelineno()`: Line number within current file
- `fileno()`: File descriptor of current file
- `isfirstline()`: Boolean check for first line of file
- `isstdin()`: Boolean check if reading from stdin

### FileInput Class (L171-398)
Core implementation providing iterator protocol and file management:

**Constructor** (L184-229): 
- Handles string, PathLike, or sequence of filenames
- Defaults to sys.argv[1:] or stdin ('-') if no files specified
- Validates mode parameter ('r' or 'rb' only)
- Sets up encoding/error handling with EncodingWarning support
- Validates openhook compatibility with inplace mode

**Iterator Protocol**:
- `__iter__()` (L246): Returns self
- `__next__()` (L249-258): Main iteration logic with automatic file advancement
- `readline()` (L290-299): Alternative line-by-line interface

**File Management**:
- `_readline()` (L301-372): Core file opening and line reading logic
  - Handles stdin detection and binary mode switching
  - Implements in-place editing with backup file creation
  - Manages custom openhook integration
  - Dynamically replaces self._readline with file.readline for performance
- `nextfile()` (L260-288): File transition cleanup with stdout restoration

**State Accessors**: Mirror module-level functions (L374-396)

### Utility Hooks
- `hook_compressed()` (L401-417): Opens .gz/.bz2 files with appropriate decompression
- `hook_encoded()` (L420-423): Creates openhook for specific encoding

## Architecture Patterns

**Singleton Pattern**: Global `_state` ensures single active FileInput instance
**Strategy Pattern**: `openhook` parameter allows custom file opening strategies  
**Iterator Protocol**: Full support with automatic file advancement
**Context Manager**: `__enter__`/`__exit__` methods for resource management
**In-place Editing**: Sophisticated backup/restore mechanism with stdout redirection

## Critical Constraints

- Only one active FileInput session allowed globally
- Mode restricted to 'r' or 'rb' for safety
- In-place editing incompatible with custom openhooks
- Stdin can only be consumed once per session
- Sequential access only - no random access support
- File permissions preserved during in-place editing

## Dependencies
- `io`: Text/binary stream handling
- `sys`, `os`: System integration and file operations  
- `types.GenericAlias`: Generic type hint support