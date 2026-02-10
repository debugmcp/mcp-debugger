# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/fileinput.py
@source-hash: b0cd2a3f01c96f59
@generated: 2026-02-09T18:14:25Z

## Primary Purpose
Python standard library module providing a unified interface for iterating over lines from multiple input files or stdin. Supports in-place file editing and custom file opening hooks.

## Key Components

### Module Functions (L78-170)
- `input()` (L78-91): Factory function creating FileInput instance with global state management
- `close()` (L93-99): Closes active FileInput sequence and clears global state
- `nextfile()` (L101-113): Skips to next file in sequence
- Accessor functions: `filename()`, `lineno()`, `filelineno()`, `fileno()`, `isfirstline()`, `isstdin()` - delegate to active FileInput instance

### FileInput Class (L171-398)
Core implementation class providing:

**Constructor** (L184-229):
- Handles file list normalization (single file, PathLike, sys.argv fallback)
- Validates mode parameter (must be 'r' or 'rb')
- Sets up encoding/error handling with warning for unspecified encoding
- Configures inplace editing and openhook validation

**Iterator Protocol** (L246-258):
- `__next__()`: Reads lines sequentially across files, auto-advances to next file
- `__iter__()`: Returns self for iteration

**File Management** (L260-289):
- `nextfile()`: Complex cleanup of current file, handles stdout restoration for inplace mode
- `_readline()` (L301-372): Lazy file opening, handles stdin detection, inplace backup creation, custom openhooks

**State Accessors** (L374-396):
- Track current filename, line numbers (cumulative and per-file), file handles

### Utility Functions (L401-423)
- `hook_compressed()` (L401-417): Built-in openhook for .gz/.bz2 files with automatic decompression
- `hook_encoded()` (L420-423): Factory for encoding-specific openhooks

## Architecture Patterns

**Global State Management**: Module maintains singleton `_state` (L76) for convenience functions while allowing multiple FileInput instances.

**Lazy File Opening**: Files opened on-demand in `_readline()`, enabling efficient handling of large file lists.

**In-place Editing**: Complex backup/restore mechanism using file renaming and stdout redirection (L329-358).

**Dynamic Method Binding**: `_readline` method dynamically bound to current file's readline (L371) for performance.

## Critical Invariants
- Only one active `input()` instance allowed globally (enforced at L87-88)
- In-place mode incompatible with openhooks (L225-226)
- File mode restricted to read-only ('r' or 'rb') (L220-221)
- Sequential access required - random access and readline() cannot be mixed (L181)

## Dependencies
- `io`, `sys`, `os` for file operations
- `types.GenericAlias` for generic type support (L398)
- Optional: `gzip`, `bz2` for compressed file support
- Optional: `warnings` for encoding warnings