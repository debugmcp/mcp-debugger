# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/py_compile.py
@source-hash: 3464f04938b57a7a
@generated: 2026-02-09T18:07:13Z

## Purpose
Python module for compiling `.py` source files to `.pyc` bytecode files. Provides both programmatic API and command-line interface for byte-compilation with support for different invalidation modes and optimization levels.

## Key Components

### Exception Classes
- **PyCompileError (L18-64)**: Custom exception for compilation failures. Wraps original exception with file context, handles SyntaxError formatting specially, stores exception metadata (exc_type_name, exc_value, file, msg).

### Enums
- **PycInvalidationMode (L66-69)**: Defines bytecode invalidation strategies:
  - `TIMESTAMP`: Traditional mtime-based invalidation
  - `CHECKED_HASH`: Hash-based with verification
  - `UNCHECKED_HASH`: Hash-based without verification

### Core Functions
- **_get_default_invalidation_mode (L72-76)**: Returns CHECKED_HASH if SOURCE_DATE_EPOCH environment variable is set (reproducible builds), otherwise TIMESTAMP.

- **compile (L79-173)**: Main compilation function. Handles:
  - Source file reading via SourceFileLoader
  - Bytecode generation with specified optimization level
  - Output file path determination (PEP 3147/488 compliance)
  - Directory creation and atomic file writing
  - Error handling with doraise/quiet flags
  - Symlink/non-regular file validation

- **main (L176-208)**: Command-line interface using argparse. Supports:
  - Multiple file compilation
  - Stdin input (when filename is '-')
  - Quiet mode for suppressed output
  - Proper exit codes on errors

## Key Dependencies
- `importlib._bootstrap_external`: Core bytecode generation and file operations
- `importlib.machinery.SourceFileLoader`: Source file loading
- `importlib.util`: Cache path generation and source hashing

## Architecture Patterns
- Uses importlib internals for bytecode generation rather than compile() builtin
- Atomic file writing to prevent corruption during compilation
- Flexible error handling with doraise parameter for library vs CLI usage
- Environment-aware default invalidation mode for reproducible builds

## Critical Constraints
- Raises FileExistsError if target is symlink or non-regular file (L133-140)
- Optimization levels: -1 (current interpreter), 0, 1, 2 (L94-96)
- Quiet levels: 0 (full output), 1 (errors only), 2 (no output) (L98-99)