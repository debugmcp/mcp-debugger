# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/py_compile.py
@source-hash: 3464f04938b57a7a
@generated: 2026-02-09T18:08:59Z

Python module for compiling .py source files to .pyc bytecode files. Part of the standard library's compilation infrastructure, with intimate knowledge of .pyc file format.

## Core Functionality
Primary purpose is byte-compilation of Python source files, used by import system and standalone compilation tools.

## Key Classes

**PyCompileError (L18-64)**: Exception class for compilation errors
- `__init__` (L46-61): Constructs error with exception type, value, file, and optional message
- Special handling for SyntaxError with formatted traceback
- Stores `exc_type_name`, `exc_value`, `file`, `msg` attributes
- `__str__` (L62-63): Returns formatted error message

**PycInvalidationMode (L66-69)**: Enum defining cache invalidation strategies
- `TIMESTAMP = 1`: Use file modification time
- `CHECKED_HASH = 2`: Use source hash with verification  
- `UNCHECKED_HASH = 3`: Use source hash without verification

## Key Functions

**`_get_default_invalidation_mode()` (L72-76)**: Returns default cache invalidation mode
- Uses CHECKED_HASH if SOURCE_DATE_EPOCH environment variable set (reproducible builds)
- Otherwise defaults to TIMESTAMP mode

**`compile()` (L79-173)**: Main compilation function
- Parameters: source file, optional output file, display file, error handling flags, optimization level, invalidation mode, quiet level
- Returns path to compiled .pyc file
- Uses `importlib.machinery.SourceFileLoader` for source loading and code compilation
- Handles output path generation via `importlib.util.cache_from_source()`
- Validates output file isn't symlink or non-regular file (L133-140)
- Creates bytecode using timestamp or hash-based invalidation (L160-170)
- Atomically writes bytecode file with proper permissions

**`main()` (L176-209)**: Command-line interface
- Uses argparse for CLI argument parsing
- Supports quiet mode and stdin input ('-')
- Compiles multiple files with error handling and exit codes

## Dependencies
- `importlib._bootstrap_external`: Low-level bytecode generation and file writing
- `importlib.machinery`: Source file loading infrastructure  
- `importlib.util`: Cache path utilities and source hashing
- Standard library modules: os, sys, traceback, enum, argparse

## Architecture Notes
- Leverages importlib's internal compilation pipeline
- Supports both timestamp and hash-based cache invalidation for reproducible builds
- Atomic file writing prevents corruption during compilation
- File permission preservation maintains security attributes
- Integration point for compileall module and import system