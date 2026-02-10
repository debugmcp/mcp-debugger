# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/codeop.py
@source-hash: 3fb545862a1f9030
@generated: 2026-02-09T18:09:32Z

**Primary Purpose**: Python standard library module that provides utilities for compiling potentially incomplete Python source code, primarily used by interactive interpreters (REPL) to determine if user input requires continuation.

**Key Functions**:
- `compile_command(source, filename, symbol)` (L92-111): Main entry point that compiles a single command, returning a code object if complete, None if incomplete, or raising syntax errors
- `_maybe_compile(compiler, source, filename, symbol)` (L49-73): Core compilation logic that handles incomplete input detection by attempting compilation with and without newlines
- `_compile(source, filename, symbol, incomplete_input)` (L84-89): Low-level compiler wrapper that sets appropriate flags for incomplete input handling
- `_is_syntax_error(err1, err2)` (L75-82): Helper to compare syntax errors and distinguish between different error types

**Key Classes**:
- `Compile` (L113-130): Stateful compiler that remembers __future__ statements across compilations, with `__call__` method that updates internal flags based on encountered future features
- `CommandCompiler` (L132-161): Higher-level wrapper around Compile that provides the same interface as compile_command but maintains state for __future__ statements

**Critical Constants**:
- `PyCF_DONT_IMPLY_DEDENT = 0x200` (L46): Compiler flag to prevent automatic dedent
- `PyCF_ALLOW_INCOMPLETE_INPUT = 0x4000` (L47): Compiler flag to allow incomplete input compilation
- `_features` (L38-39): List of all __future__ features for flag management

**Dependencies**: 
- `__future__` module for feature flag management
- `warnings` module for suppressing compiler warnings during incomplete input checks

**Architectural Patterns**:
- Stateful compilation: Classes maintain compiler flags across multiple invocations
- Error-based flow control: Uses SyntaxError exceptions to detect incomplete input
- Two-stage compilation: Attempts compilation with and without additional newline to distinguish syntax errors from incomplete input

**Critical Behavior**:
- Empty/comment-only input (L50-57) is replaced with "pass" statement for non-eval modes
- Incomplete input detection relies on specific "incomplete input" error message matching (L69)
- __future__ statement flags are accumulated and persist across compilations in stateful classes