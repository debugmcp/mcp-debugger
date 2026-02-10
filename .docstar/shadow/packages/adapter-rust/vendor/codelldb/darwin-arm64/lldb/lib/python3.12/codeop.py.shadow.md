# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/codeop.py
@source-hash: 3fb545862a1f9030
@generated: 2026-02-09T18:07:02Z

## Primary Purpose
Python source code compilation utility that handles incomplete code fragments, primarily used by interactive interpreters (REPL, IPython). Provides intelligent compilation that can distinguish between incomplete input and syntax errors.

## Key Functions

**compile_command (L92-111)**: Main public function that compiles a single command and returns:
- Code object if complete and valid
- None if incomplete (needs more input)
- Raises SyntaxError/ValueError/OverflowError for actual syntax errors

**_maybe_compile (L49-73)**: Core compilation logic that:
- Handles blank/comment-only source by replacing with 'pass'
- Uses two-pass compilation to detect incomplete input
- Suppresses compiler warnings during incomplete input detection
- Returns None for incomplete input, code object for complete input

**_compile (L84-89)**: Low-level wrapper around built-in compile() that sets appropriate flags:
- PyCF_ALLOW_INCOMPLETE_INPUT: Allows incomplete syntax
- PyCF_DONT_IMPLY_DEDENT: Prevents automatic dedentation

**_is_syntax_error (L75-82)**: Helper to compare SyntaxError instances, special handling for unclosed brackets/parentheses.

## Key Classes

**Compile (L113-130)**: Stateful compiler that remembers `__future__` statements:
- Maintains compilation flags that accumulate future features
- `__call__` method compiles source and updates internal flags based on future imports
- Used as building block for CommandCompiler

**CommandCompiler (L132-161)**: High-level interface with same signature as compile_command but with future statement memory:
- Wraps Compile instance to provide stateful compilation
- Primary interface for interactive environments that need future statement persistence

## Dependencies
- `__future__`: For accessing future feature flags
- `warnings`: For suppressing compiler warnings during incomplete input detection

## Architecture Notes
- Two-tier compilation strategy: first attempt compilation, then try with newline appended
- Future statement handling through compiler flag accumulation
- Special handling for eval vs exec/single modes (no 'pass' replacement for eval)
- Undocumented compiler flags from CPython's compile.h (PyCF_* constants L46-47)

## Critical Invariants
- Empty/comment-only input in non-eval mode becomes 'pass' statement
- Future statements must persist across multiple compilation calls within same CommandCompiler instance
- Incomplete input detection relies on string matching "incomplete input" in SyntaxError messages