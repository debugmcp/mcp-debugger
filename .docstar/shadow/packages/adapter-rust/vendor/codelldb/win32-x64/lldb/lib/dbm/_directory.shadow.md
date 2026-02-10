# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/dbm/
@generated: 2026-02-09T18:16:13Z

## Overall Purpose and Responsibility

The `dbm` package provides a unified interface for database management functionality within the LLDB debugger's Python environment. This is a complete implementation of Python's standard `dbm` package, offering multiple database backends with automatic detection and fallback mechanisms for persistent key-value storage.

## Architecture and Component Relationships

The package implements a **strategy pattern** with a central dispatcher (`__init__.py`) that manages multiple database backend implementations:

- **`__init__.py`**: Main orchestrator providing unified API and automatic backend selection
- **`dumb.py`**: Pure Python fallback implementation using file-based storage (.dir/.dat files)  
- **`gnu.py`**: Thin wrapper around GNU DBM C extension (`_gdbm`)
- **`ndbm.py`**: Bridge module re-exporting the NDBM C extension (`_dbm`)

The architecture prioritizes GNU DBM, falls back to NDBM, and finally uses the pure Python "dumb" implementation if C extensions are unavailable.

## Public API Surface

### Primary Entry Point
**`dbm.open(file, flag='r', mode=0o666)`** - Main interface that:
- Automatically detects existing database format using `whichdb()`
- Selects appropriate backend implementation  
- Returns a database object supporting `MutableMapping` interface
- Handles standard flags: 'r' (read), 'w' (write), 'c' (create if needed), 'n' (new)

### Database Format Detection
**`dbm.whichdb(filename)`** - Examines file signatures and extensions to identify:
- NDBM format (`.pag`/`.dir` files, magic numbers)
- DumbDBM format (`.dat`/`.dir` files, content validation)  
- GNU DBM format (magic numbers `0x13579ace`, `0x13579acd`, `0x13579acf`)
- Berkeley DB format (padded magic numbers)

### Error Handling
**`dbm.error`** - Exception hierarchy including OSError for comprehensive error handling across all backends

## Internal Organization and Data Flow

1. **Lazy Module Loading**: Backend modules imported only when first needed, with caching via `_modules` dictionary
2. **Priority-Based Selection**: Attempts backends in order: `['dbm.gnu', 'dbm.ndbm', 'dbm.dumb']`
3. **Format Detection Pipeline**: For existing databases, `whichdb()` analyzes file patterns and magic numbers before backend selection
4. **Fallback Chain**: Graceful handling of ImportError exceptions when C extensions unavailable

## Backend-Specific Implementations

### DumbDBM (Pure Python)
- File-based storage with directory index (`.dir`) and binary data (`.dat`)
- Block-aligned storage with 512-byte boundaries
- Atomic commits using backup-and-rename strategy
- Full MutableMapping interface with context manager support

### GNU DBM & NDBM (C Extensions)  
- Thin wrappers around native C libraries (`_gdbm`, `_dbm`)
- High-performance native database operations
- Platform-specific implementations

## Key Patterns and Conventions

- **Unified Interface**: All backends provide consistent MutableMapping-style access
- **Automatic Backend Selection**: Transparent to end users - format detection and fallback handled internally  
- **Encoding Flexibility**: Support for both string and bytes keys/values with UTF-8/Latin-1 encoding strategies
- **Cross-Platform Compatibility**: Pure Python fallback ensures functionality across all platforms
- **LLDB Integration**: Embedded within LLDB's Python environment for debugger scripting support

## Critical Operational Characteristics

- **No Concurrent Access**: Database files not safe for multi-process access
- **Format Persistence**: Once created, database format determined by initial backend selection
- **Memory vs. Disk Trade-offs**: DumbDBM loads full index into memory; C extensions may use different strategies
- **Crash Safety**: DumbDBM provides atomic commits; C extension safety depends on underlying implementation