# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/compileall.py
@source-hash: 588f003bb5088ce3
@generated: 2026-02-09T18:14:21Z

## Purpose
Python bytecode compilation module that recursively compiles `.py` files to `.pyc` files. Part of LLDB debugger's Python distribution for the CodeLLDB VSCode extension adapter.

## Key Functions

### Core Compilation Functions
- **`compile_dir()`** (L48-129): Main directory compilation function with parallel processing support via ProcessPoolExecutor. Handles recursive traversal, optimization levels, and various path manipulation options.
- **`compile_file()`** (L131-278): Individual file compilation with timestamp checking, multiple optimization levels, and hardlinking of duplicate bytecode files.
- **`compile_path()`** (L280-311): Compiles all modules on sys.path, wrapping compile_dir for each path entry.

### Helper Functions
- **`_walk_dir()`** (L25-46): Recursive directory traversal generator that yields file paths while respecting maxlevels and skipping __pycache__ directories.
- **`main()`** (L314-464): Command-line interface with extensive argument parsing for all compilation options.

## Key Dependencies
- `py_compile`: Core bytecode compilation functionality
- `importlib.util`: Cache file path generation and magic number handling
- `concurrent.futures.ProcessPoolExecutor`: Parallel compilation support
- `pathlib.Path`: Modern path manipulation for symlink resolution
- `filecmp`: Duplicate file comparison for hardlinking

## Architecture Patterns

### Path Manipulation System
Complex path transformation logic using `stripdir` and `prependdir` parameters (L172-187) that allows for build-time path rewriting in compiled bytecode.

### Parallel Processing Strategy
Dynamic worker selection based on system capabilities (L86-94) with fallback to sequential processing. Uses forkserver context on Unix systems for better isolation.

### Optimization Level Handling
Supports multiple optimization levels simultaneously (L189-194), with duplicate detection and optional hardlinking for identical bytecode files (L249-253).

## Critical Invariants
- `ddir` parameter is mutually exclusive with `stripdir`/`prependdir` (L77-83, L158-160)
- Hardlinking requires multiple optimization levels (L196-198)
- Timestamp-based cache validation using Python's magic number format (L228-240)
- Symlink limitation enforced via `limit_sl_dest` parameter (L205-207)

## Notable Implementation Details
- Uses struct packing for bytecode header validation (L230-231)
- Error handling preserves compilation success state across files (L122-128)
- Unicode-safe error message encoding for output (L263-264)
- Graceful degradation when ProcessPoolExecutor unavailable (L87-92)