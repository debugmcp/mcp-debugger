# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/compileall.py
@source-hash: 588f003bb5088ce3
@generated: 2026-02-09T18:07:09Z

## Primary Purpose

Standard Python module for batch compilation of .py files to .pyc bytecode files. Provides both programmatic API and command-line interface for recursive directory compilation with extensive configuration options.

## Key Functions

**`_walk_dir(dir, maxlevels, quiet=0)` (L25-46)**
- Internal generator that recursively walks directory trees
- Skips `__pycache__` directories and respects maxlevels depth limit
- Yields file paths for compilation, handles OSError gracefully

**`compile_dir(dir, maxlevels=None, ddir=None, force=False, ...)` (L48-129)**
- Main directory compilation function with extensive parameter set
- Supports parallel processing via ProcessPoolExecutor when workers > 1 (L99-120)
- Handles path transformations (stripdir/prependdir vs ddir - mutually exclusive)
- Returns boolean success status

**`compile_file(fullname, ddir=None, force=False, ...)` (L131-278)**
- Core single-file compilation logic
- Implements timestamp-based compilation skipping unless force=True (L227-240)
- Supports multiple optimization levels with hardlinking for duplicates (L189-198, L249-253)
- Handles path transformations and symlink restrictions
- Uses py_compile.compile() for actual bytecode generation (L246-248)

**`compile_path(skip_curdir=1, maxlevels=0, ...)` (L280-311)**
- Compiles all modules on sys.path
- Wrapper around compile_dir() for each path entry

**`main()` (L314-464)**
- Command-line interface with argparse
- Extensive argument validation and error handling
- Supports file list input via -i flag (L413-422)
- Maps CLI invalidation mode strings to enum values (L424-428)

## Key Dependencies

- `py_compile`: Core bytecode compilation (L16, L246-248, L254, L368, L426)
- `concurrent.futures.ProcessPoolExecutor`: Parallel compilation (L88, L94, L107-119)
- `importlib.util`: Bytecode cache path generation and magic numbers (L15, L218-223, L230)
- `pathlib.Path`: Path resolution for symlink checking (L21, L206)

## Architecture Patterns

**Path Transformation Pipeline**: 
- stripdir removes prefix, prependdir adds prefix, ddir is legacy shorthand
- These operations are mutually exclusive (L77-83, L158-160, L407-410)

**Optimization Level Handling**:
- Converts int to list, deduplicates and sorts for deterministic output (L189-194)
- Each level generates separate .pyc file with different cache paths (L212-223)

**Parallel Processing Strategy**:
- Falls back to sequential if ProcessPoolExecutor unavailable (L87-94)
- Uses forkserver context on fork-capable systems for better isolation (L100-104)

## Critical Constraints

- ddir parameter cannot combine with stripdir/prependdir (enforced L77-83, L158-160, L407-410)
- Hardlink duplication requires multiple optimization levels (L196-198, L403-405)
- Workers must be >= 0 (L84-85)
- Symlink following restricted by limit_sl_dest parameter (L205-207)

## Notable Implementation Details

- Bytecode freshness checking via magic number + timestamp comparison (L228-240)
- Error encoding handling for non-printable characters in compilation errors (L263-264)
- Graceful degradation when ProcessPoolExecutor unavailable on platform (L87-94)
- File list input supports stdin via "-" argument (L415-416)