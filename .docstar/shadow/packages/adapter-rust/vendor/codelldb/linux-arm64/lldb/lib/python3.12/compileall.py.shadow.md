# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/compileall.py
@source-hash: 588f003bb5088ce3
@generated: 2026-02-09T18:08:41Z

## Purpose
Python standard library module for batch byte-compilation of .py files to .pyc files. Supports recursive directory compilation, parallel processing, and various optimization levels. Can be used as both a module and command-line script.

## Core Functions

### `_walk_dir(dir, maxlevels, quiet=0)` (L25-46)
Internal directory traversal generator that recursively yields Python files while skipping __pycache__ directories and following symlinks up to maxlevels depth. Handles PathLike objects and provides optional progress output.

### `compile_dir(dir, maxlevels=None, ddir=None, force=False, ...)` (L48-129) 
Main directory compilation function with extensive configuration options:
- Uses `_walk_dir()` to discover files
- Supports parallel compilation via ProcessPoolExecutor when workers > 1
- Falls back to sequential processing if multiprocessing unavailable
- Handles path manipulation (stripdir/prependdir vs ddir)
- Returns boolean success status

Key features:
- Multiprocessing with forkserver context when available (L100-104)
- ProcessPoolExecutor with partial function application (L107-119)
- Sequential fallback for single worker or unsupported systems

### `compile_file(fullname, ddir=None, force=False, ...)` (L131-278)
Core single-file compilation function:
- Handles path transformations (stripdir/prependdir logic L172-187)
- Supports multiple optimization levels simultaneously (L189-194)
- Implements timestamp-based up-to-date checking (L227-240)
- Optional hardlinking of duplicate bytecode files (L249-253)
- Comprehensive error handling for compilation failures

### `compile_path(skip_curdir=1, maxlevels=0, ...)` (L280-311)
Compiles all modules on sys.path using compile_dir() for each path entry. Typically used when no specific targets are provided.

### `main()` (L314-464)
Command-line interface with argparse handling:
- Extensive argument parsing for all compilation options (L318-383)
- File list input support via -i flag (L413-422)
- Validation of incompatible option combinations
- Handles both file and directory targets

## Key Dependencies
- `py_compile`: Core bytecode compilation (L16)
- `importlib.util`: Cache file path generation and magic numbers (L15)
- `concurrent.futures`: Parallel processing support (L88, L94)
- `multiprocessing`: Process context management (L100-104)
- `pathlib.Path`: Modern path handling for symlink resolution (L206)

## Important Patterns
- **Path handling**: Supports both legacy string paths and os.PathLike objects
- **Optimization levels**: Converts single int to list, removes duplicates, sorts for determinism (L189-194)
- **Error resilience**: Catches and handles OSError, SyntaxError, UnicodeError, PyCompileError
- **Progress reporting**: Three-level quiet system (0=verbose, 1=errors only, 2=silent)
- **Hardlink deduplication**: Compares bytecode files and hardlinks identical ones to save space

## Critical Constraints
- `ddir` parameter mutually exclusive with `stripdir`/`prependdir` (L77-79, L158-160)
- Hardlink duplication requires multiple optimization levels (L196-198)
- ProcessPoolExecutor requires system support check (L88-92)
- Symlink following limited by `limit_sl_dest` parameter (L205-207)

## Module Exports
`__all__ = ["compile_dir","compile_file","compile_path"]` (L23)