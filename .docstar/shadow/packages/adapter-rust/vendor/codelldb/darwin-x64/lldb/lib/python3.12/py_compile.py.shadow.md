# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/py_compile.py
@source-hash: 3464f04938b57a7a
@generated: 2026-02-09T18:07:57Z

## Purpose
Python module for compiling Python source files (.py) to bytecode files (.pyc). Provides programmatic API and command-line interface for Python bytecode compilation with error handling and optimization support.

## Key Classes

### PyCompileError (L18-64)
Custom exception for compilation errors. Wraps underlying exceptions with enhanced error messages.
- `__init__(exc_type, exc_value, file, msg='')` (L46): Formats error messages, handles SyntaxError specially
- `__str__()` (L62): Returns formatted error message
- Stores: `exc_type_name`, `exc_value`, `file`, `msg` attributes

### PycInvalidationMode (L66-69)
Enum defining bytecode invalidation strategies:
- `TIMESTAMP`: Use file modification time (traditional)
- `CHECKED_HASH`: Use source hash with verification
- `UNCHECKED_HASH`: Use source hash without verification

## Core Functions

### compile() (L79-173)
Main compilation function. Converts Python source to bytecode with comprehensive options.
- **Parameters**: `file`, `cfile`, `dfile`, `doraise`, `optimize`, `invalidation_mode`, `quiet`
- **Logic Flow**:
  - Determines output file path using PEP 3147/488 conventions (L126-132)
  - Validates target file isn't symlink/non-regular file (L133-140)
  - Loads source using `SourceFileLoader` (L141-142)
  - Compiles to code object with optimization (L144-145)
  - Creates bytecode using timestamp or hash invalidation (L160-170)
  - Writes atomically to filesystem (L171-172)
- **Error Handling**: Wraps exceptions in PyCompileError, respects `doraise` and `quiet` flags

### _get_default_invalidation_mode() (L72-76)
Returns appropriate invalidation mode based on SOURCE_DATE_EPOCH environment variable (for reproducible builds).

### main() (L176-208)
Command-line interface using argparse. Processes multiple files, handles stdin input with '-', exits with appropriate codes on errors.

## Dependencies
- `importlib.*`: Core compilation machinery, file loaders, bytecode generation
- Standard library: `os`, `sys`, `traceback`, `enum`, `argparse`

## Key Patterns
- **Error wrapping**: All compilation exceptions wrapped in PyCompileError for consistent handling
- **Atomic writes**: Uses `_write_atomic()` to prevent partial file corruption
- **PEP compliance**: Follows PEP 3147 (pyc repository) and PEP 488 (elimination of .pyo files)
- **Reproducible builds**: SOURCE_DATE_EPOCH support for deterministic compilation

## Critical Constraints
- Target file validation prevents overwriting symlinks/non-regular files
- Optimization level must be -1, 0, 1, or 2
- Hash-based invalidation requires source bytes for hash computation
- Directory creation is attempted but FileExistsError is silently ignored