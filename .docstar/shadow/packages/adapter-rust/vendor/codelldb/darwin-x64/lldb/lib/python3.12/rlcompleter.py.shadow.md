# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/rlcompleter.py
@source-hash: fee9ad9c55529be4
@generated: 2026-02-09T18:07:56Z

## Primary Purpose
Python module providing intelligent tab completion for GNU readline, enabling context-aware autocompletion of keywords, built-ins, globals, and object attributes in interactive Python environments.

## Core Class: Completer (L41-200)

**Constructor (L42-67)**: Initializes with optional namespace dict, defaults to `__main__.__dict__`. Uses lazy binding pattern - stores `use_main_ns` flag instead of immediate namespace binding.

**Main Entry Point: complete() (L69-98)**: Primary readline integration method called iteratively with incrementing state values until returning None. Routes to either `global_matches()` or `attr_matches()` based on presence of dots in text.

**Global Completion: global_matches() (L111-136)**: Handles simple name completion by combining:
- Python keywords (with smart postfix: ':' for try/finally, ' ' for most others)
- Built-in functions
- Current namespace variables
- Callable detection with automatic parentheses via `_callable_postfix()`

**Attribute Completion: attr_matches() (L138-200)**: Complex dotted expression completion using regex pattern `(\w+(\.\w+)*)\.(\w*)`. Evaluates expression prefix safely, then uses `dir()` to find matching attributes. Implements intelligent underscore filtering (private/dunder attributes) and property detection to avoid unwanted evaluations.

## Helper Functions

**_callable_postfix() (L100-109)**: Adds parentheses to callable completions, with smart closing for zero-parameter functions using `inspect.signature()`.

**get_class_members() (L202-207)**: Recursive function to collect all class attributes including inherited members from base classes.

## Module Initialization (L209-219)
Conditional readline integration with graceful ImportError handling. Sets up global completer instance and registers cleanup via `atexit` to prevent reference cycles.

## Key Dependencies
- `readline`: GNU readline library interface
- `inspect`: Function signature analysis
- `__main__`: Default completion namespace
- `keyword`: Python keyword lists
- `builtins`: Built-in function access

## Architecture Notes
- **Lazy namespace binding**: Defers `__main__.__dict__` binding until completion time
- **Security consideration**: Uses `eval()` for attribute completion (documented risk in L21-25)
- **Graceful degradation**: Functions without readline availability
- **State-based iteration**: Implements readline's stateful completion protocol