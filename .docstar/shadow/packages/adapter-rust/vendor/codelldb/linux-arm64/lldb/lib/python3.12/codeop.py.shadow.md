# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/codeop.py
@source-hash: 3fb545862a1f9030
@generated: 2026-02-09T18:08:36Z

## Python Code Compilation Utilities

This module provides utilities for compiling potentially incomplete Python source code, primarily used by interactive Python environments like REPL and debuggers. It handles partial code input and `__future__` statement persistence.

### Core Functionality
- **Purpose**: Distinguish between incomplete Python code (requiring more input) and syntax errors
- **Key capability**: Compile code fragments while preserving `__future__` imports across compilation sessions

### Public Interface

**`compile_command(source, filename="<input>", symbol="single")` (L92-111)**
- Main entry point for single-command compilation
- Returns: code object (complete), None (incomplete), or raises SyntaxError
- Delegates to `_maybe_compile()` with basic `_compile()` function

**`CommandCompiler` class (L132-161)**
- Stateful compiler that remembers `__future__` statements
- `__call__(source, filename, symbol)` method (L142-161) matches `compile_command` signature
- Uses internal `Compile` instance for persistent future flags

**`Compile` class (L113-131)**
- Lower-level stateful compiler with `__future__` memory
- `__call__(source, filename, symbol, **kwargs)` (L121-131) with `incomplete_input` parameter
- Tracks future statement flags in `self.flags` attribute

### Internal Implementation

**`_maybe_compile(compiler, source, filename, symbol)` (L49-73)**
- Core logic for incomplete code detection
- Handles blank/comment-only source (converts to "pass" for non-eval)
- Uses two-pass compilation: first with original source, then with added newline
- Checks for "incomplete input" in SyntaxError messages

**`_compile(source, filename, symbol, incomplete_input=True)` (L84-89)**
- Wrapper around built-in `compile()` with completion flags
- Sets `PyCF_ALLOW_INCOMPLETE_INPUT` and `PyCF_DONT_IMPLY_DEDENT` flags

**`_is_syntax_error(err1, err2)` (L75-82)**
- Helper for comparing SyntaxError instances
- Special handling for unclosed bracket errors

### Dependencies & Constants
- **Imports**: `__future__`, `warnings` modules
- **Future features**: `_features` list (L38-39) from `__future__.all_feature_names`
- **Compiler flags**: `PyCF_DONT_IMPLY_DEDENT = 0x200`, `PyCF_ALLOW_INCOMPLETE_INPUT = 0x4000` (L46-47)

### Architecture Pattern
Layered design: `compile_command` → `_maybe_compile` → `_compile` → built-in `compile()`
State management through class instances for persistent `__future__` handling