# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/py_compile.py
@source-hash: 3464f04938b57a7a
@generated: 2026-02-09T18:09:51Z

## py_compile.py

**Primary Purpose**: Core Python module for compiling .py source files to .pyc bytecode files with comprehensive error handling and optimization support.

### Key Classes

**PyCompileError (L18-64)**: Custom exception for compilation failures
- Constructor accepts exc_type, exc_value, file, and optional msg
- Special handling for SyntaxError with formatted traceback (L48-51)
- Exposes exc_type_name, exc_value, file, and msg attributes
- __str__ returns formatted error message

**PycInvalidationMode (L66-70)**: Enum defining bytecode cache invalidation strategies
- TIMESTAMP: Use file modification time (traditional)
- CHECKED_HASH: Use source hash with verification
- UNCHECKED_HASH: Use source hash without verification

### Core Functions

**compile() (L79-173)**: Main compilation function with extensive parameter control
- Converts Python source to bytecode with configurable optimization levels (-1, 0, 1, 2)
- Handles cache file path generation via importlib.util.cache_from_source()
- Validates target file isn't symlink or non-regular file (L133-140)
- Uses importlib.machinery.SourceFileLoader for source processing
- Supports both timestamp and hash-based invalidation modes
- Returns path to compiled .pyc file or None on failure

**_get_default_invalidation_mode() (L72-76)**: Determines invalidation strategy based on SOURCE_DATE_EPOCH environment variable

**main() (L176-209)**: Command-line interface using argparse
- Accepts multiple filenames or reads from stdin when given '-'
- Quiet mode suppresses error output
- Exits with status 1 on compilation errors

### Dependencies & Architecture

- **importlib._bootstrap_external**: Low-level bytecode generation (_code_to_timestamp_pyc, _code_to_hash_pyc, _write_atomic)
- **importlib.machinery.SourceFileLoader**: Source file reading and code compilation
- **importlib.util**: Cache path utilities and source hashing

### Critical Behavior Patterns

- Atomic file writing prevents corruption during compilation
- Directory creation with FileExistsError suppression (L155-159)
- Error handling respects quiet levels (0=full, 1=errors only, 2=silent)
- Optimization level -1 uses current interpreter settings
- File type validation prevents overwriting special files with regular bytecode files

### Key Invariants

- Always validates target file type before compilation
- Uses atomic writes to prevent partial bytecode files
- Maintains consistent error message formatting across exception types
- Respects SOURCE_DATE_EPOCH for reproducible builds