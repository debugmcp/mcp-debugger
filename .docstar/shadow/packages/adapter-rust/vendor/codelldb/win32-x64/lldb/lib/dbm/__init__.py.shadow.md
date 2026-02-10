# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/dbm/__init__.py
@source-hash: 389407b292f30c38
@generated: 2026-02-09T18:10:33Z

## Primary Purpose
Generic interface module for all DBM (Database Manager) implementations in Python's standard library. Provides a unified API to access different DBM backends (GNU DBM, NDBM, DumbDBM) with automatic database type detection and fallback mechanisms.

## Key Functions

### `open(file, flag='r', mode=0o666)` (L53-95)
Main entry point that opens or creates a database file. Implements lazy initialization of available DBM modules and automatic type detection:
- Uses `whichdb()` to detect existing database format unless 'n' flag specified
- Falls back to default module for new databases
- Supports standard flags: 'r' (read), 'w' (write), 'c' (create if needed), 'n' (new)
- Returns appropriate DBM module's database object

### `whichdb(filename)` (L98-185)
Database format detection function that examines file signatures and extensions:
- **NDBM detection** (L111-133): Checks for `.pag` and `.dir` files, also handles `.db` files with validation
- **DumbDBM detection** (L135-150): Looks for `.dat` and `.dir` files, validates content starts with quote
- **GNU DBM detection** (L173-175): Reads magic numbers `0x13579ace`, `0x13579acd`, `0x13579acf`
- **Berkeley DB detection** (L177-182): Handles 12-byte padding before magic number
- Returns module name string, empty string if unrecognized, or None if file doesn't exist

## Key Classes and Variables

### `error` (L38-39, L45)
Exception class hierarchy - initially defined as simple Exception, then redefined as tuple including OSError for broader error handling.

### Module Management (L41-43)
- `_names`: Priority list of DBM implementations `['dbm.gnu', 'dbm.ndbm', 'dbm.dumb']`
- `_defaultmod`: Cached reference to first successfully imported module
- `_modules`: Dictionary mapping module names to imported module objects

## Dependencies
- **Standard library**: `io`, `os`, `struct`, `sys`
- **Conditional import**: `dbm.ndbm` with graceful fallback (L47-50)
- **Dynamic imports**: DBM implementation modules loaded on-demand (L68)

## Architectural Patterns

### Lazy Initialization
Modules are imported only when first needed in `open()`, with caching to avoid repeated imports.

### Strategy Pattern
Different DBM implementations accessed through common interface, with runtime selection based on file detection or availability.

### Fallback Chain
Attempts multiple DBM types in priority order, gracefully handling ImportError exceptions.

## Critical Invariants
- Module loading order determines default implementation preference
- Database type detection must occur before module selection (except for new databases)
- File extension patterns are DBM-implementation specific and must be checked in correct order
- Magic number detection requires exact 4-byte reads and proper endianness handling