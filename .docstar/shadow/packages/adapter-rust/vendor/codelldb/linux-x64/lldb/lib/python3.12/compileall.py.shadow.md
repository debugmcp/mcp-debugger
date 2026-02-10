# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/compileall.py
@source-hash: 588f003bb5088ce3
@generated: 2026-02-09T18:09:41Z

## Primary Purpose

Python module for batch compilation of `.py` files to `.pyc` bytecode files. Supports recursive directory traversal, parallel processing, and multiple optimization levels. Can be used as both a library and command-line script.

## Key Functions

### `_walk_dir(dir, maxlevels, quiet=0)` (L25-46)
Internal generator that recursively walks directory tree, yielding file paths while respecting max depth and skipping `__pycache__` directories. Handles OSError gracefully and supports quiet modes.

### `compile_dir(dir, maxlevels=None, ddir=None, force=False, rx=None, quiet=0, legacy=False, optimize=-1, workers=1, invalidation_mode=None, *, stripdir=None, prependdir=None, limit_sl_dest=None, hardlink_dupes=False)` (L48-129)
Main directory compilation function. Features:
- Parallel processing via ProcessPoolExecutor (L94-120) when workers > 1
- Automatic worker count detection and fallback to single-threaded (L84-94)
- Uses forkserver multiprocessing context on fork-capable systems (L101-104)
- Path manipulation with stripdir/prependdir (mutually exclusive with ddir) (L77-83)

### `compile_file(fullname, ddir=None, force=False, rx=None, quiet=0, legacy=False, optimize=-1, invalidation_mode=None, *, stripdir=None, prependdir=None, limit_sl_dest=None, hardlink_dupes=False)` (L131-278)
Core single-file compilation function. Key behaviors:
- Timestamp-based compilation checks using magic number and mtime (L227-240)
- Multiple optimization level support with deduplication (L189-194)
- Hardlinking of identical bytecode files (L249-253)
- Path stripping/prepending logic (L172-187)
- Symlink destination limiting (L205-207)
- Comprehensive error handling for PyCompileError, SyntaxError, UnicodeError, OSError (L254-277)

### `compile_path(skip_curdir=1, maxlevels=0, force=False, quiet=0, legacy=False, optimize=-1, invalidation_mode=None)` (L280-311)
Compiles all modules on sys.path, with option to skip current directory.

### `main()` (L314-464)
Command-line interface with argparse. Notable features:
- Comprehensive argument validation (L407-410, L403-405)
- File list input support via `-i` flag (L413-422)
- Invalidation mode enum conversion (L424-428)
- Handles both file and directory targets (L432-454)

## Dependencies
- **Core**: `os`, `sys`, `importlib.util`, `py_compile`, `struct`, `filecmp` (L13-18)
- **Functional**: `functools.partial`, `pathlib.Path` (L20-21)
- **Conditional**: `concurrent.futures.ProcessPoolExecutor` (imported only when workers > 1)
- **CLI**: `argparse`, `re` (imported in main())

## Architecture Patterns

### Parallel Processing Strategy
Uses ProcessPoolExecutor with partial function application to maintain state across worker processes. Falls back gracefully to single-threaded on systems where multiprocessing is limited.

### Path Manipulation Pipeline
1. stripdir removes prefix from source path
2. prependdir adds new prefix  
3. ddir provides alternative simple prefix (mutually exclusive)

### Optimization Level Handling
Converts single int to list, deduplicates with set(), sorts for deterministic output. Enables hardlinking of identical bytecode across optimization levels.

## Critical Constraints

- `ddir` cannot be used with `stripdir`/`prependdir` (L77-79, L158-160)
- `hardlink_dupes` requires multiple optimization levels (L196-198, L403-405)
- Workers must be >= 0 (L84-85)
- Symlink destinations can be limited to specific paths (L205-207)

## Public API
Exports: `compile_dir`, `compile_file`, `compile_path` (L23)