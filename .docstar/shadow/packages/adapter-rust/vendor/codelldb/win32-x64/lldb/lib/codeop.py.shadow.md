# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/codeop.py
@source-hash: 3fb545862a1f9030
@generated: 2026-02-09T18:12:52Z

## Purpose
Python source code compilation utility for handling incomplete code, particularly for interactive environments like REPLs. Provides intelligent handling of partial Python statements by detecting whether code is syntactically complete, incomplete, or contains errors.

## Key Components

### Core Functions
- **`compile_command()` (L92-111)**: Primary public function that compiles a single command and returns a code object if complete, None if incomplete, or raises SyntaxError for invalid syntax
- **`_maybe_compile()` (L49-73)**: Internal helper that implements the core logic for detecting incomplete vs invalid code by attempting compilation with different strategies
- **`_compile()` (L84-89)**: Wrapper around built-in compile() that applies appropriate compilation flags for incomplete input handling
- **`_is_syntax_error()` (L75-82)**: Utility to compare SyntaxError instances for equivalence

### Classes
- **`Compile` (L113-130)**: Stateful compiler that remembers `__future__` statements across compilations. Maintains compiler flags and updates them when future imports are encountered
- **`CommandCompiler` (L132-161)**: High-level interface wrapping `Compile` with same signature as `compile_command()` but with persistent `__future__` statement memory

### Key Constants
- **`PyCF_DONT_IMPLY_DEDENT` (L46)**: Compilation flag (0x200) preventing automatic dedent inference
- **`PyCF_ALLOW_INCOMPLETE_INPUT` (L47)**: Compilation flag (0x4000) enabling incomplete input detection
- **`_features` (L38-39)**: List of all available `__future__` features for tracking compiler state

## Core Logic Flow
1. **Input Sanitization**: `_maybe_compile()` checks for empty/comment-only code and replaces with 'pass' for non-eval modes
2. **Incomplete Detection**: Attempts compilation, then compilation with added newline to detect incomplete statements
3. **Error Differentiation**: Distinguishes between syntax errors and incomplete input by examining error messages
4. **Future Statement Persistence**: `Compile` class tracks and applies `__future__` flags across multiple compilations

## Dependencies
- `__future__`: For accessing future feature definitions and compiler flags
- `warnings`: For suppressing compilation warnings during incomplete input detection

## Usage Patterns
- **REPL/Interactive**: Use `CommandCompiler` for persistent sessions with future statement memory
- **Single Commands**: Use `compile_command()` for one-off compilation attempts
- **Custom Compilation**: Use `Compile` directly for fine-grained control over compilation flags

## Critical Behavior
- Returns `None` specifically for incomplete input (not syntax errors)
- Preserves all exception types except handles SyntaxError specially for incomplete detection
- Automatically handles comment-only and whitespace-only input