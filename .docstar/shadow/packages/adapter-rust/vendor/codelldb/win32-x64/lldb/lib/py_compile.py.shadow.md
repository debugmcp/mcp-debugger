# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/py_compile.py
@source-hash: 3464f04938b57a7a
@generated: 2026-02-09T18:14:22Z

## Primary Purpose
Core Python module for compiling `.py` source files to `.pyc` bytecode files. Part of the LLDB debugging environment, providing programmatic and command-line interfaces for bytecode compilation with configurable optimization levels and invalidation modes.

## Key Classes and Functions

### PyCompileError (L18-64)
Custom exception class for compilation errors. Wraps underlying exceptions with enhanced error messages and file context. Key attributes:
- `exc_type_name`: Original exception type name
- `exc_value`: Original exception value  
- `file`: Source file being compiled
- `msg`: Formatted error message (special handling for SyntaxError)

### PycInvalidationMode (L66-69)
Enum defining bytecode invalidation strategies:
- `TIMESTAMP` (1): Traditional mtime-based invalidation
- `CHECKED_HASH` (2): Hash-based with verification
- `UNCHECKED_HASH` (3): Hash-based without verification

### compile() (L79-173)
Main compilation function that converts Python source to bytecode. Parameters:
- `file`: Source file path
- `cfile`: Target bytecode path (auto-generated if None using PEP 3147/488)
- `dfile`: Display name for error messages
- `doraise`: Whether to raise exceptions or print to stderr
- `optimize`: Optimization level (-1=current interpreter, 0-2=explicit)
- `invalidation_mode`: How to handle cache invalidation
- `quiet`: Output verbosity control (0=full, 1=errors only, 2=silent)

Process flow:
1. Determines invalidation mode via `_get_default_invalidation_mode()` (L72-76)
2. Generates output path using `importlib.util.cache_from_source()`
3. Validates target path (prevents overwriting symlinks/non-regular files)
4. Loads and compiles source using `SourceFileLoader`
5. Creates bytecode with timestamp or hash-based headers
6. Atomically writes bytecode file

### main() (L176-209)
Command-line interface using argparse. Supports:
- Batch compilation of multiple files
- Reading filenames from stdin (when arg is '-')
- Quiet mode for suppressing output
- Proper exit codes for CI/automation

## Dependencies
- `importlib._bootstrap_external`: Low-level bytecode generation
- `importlib.machinery.SourceFileLoader`: Source file loading
- `importlib.util`: Cache path generation and source hashing
- Standard library: `os`, `sys`, `traceback`, `enum`, `argparse`

## Architectural Patterns
- **Error Wrapping**: All compilation exceptions wrapped in PyCompileError with enhanced context
- **Atomic Writes**: Uses `_write_atomic()` to prevent corrupted bytecode files
- **Path Safety**: Explicit validation prevents overwriting special files
- **Flexible Invalidation**: Supports both traditional timestamp and modern hash-based cache invalidation
- **Environment Integration**: Respects `SOURCE_DATE_EPOCH` for reproducible builds

## Critical Invariants
- Output file must be regular file (not symlink/device/etc.)
- Bytecode format matches Python version and optimization level
- Compilation errors preserve original exception context
- Directory creation is idempotent (ignores FileExistsError)