# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/asyncio/format_helpers.py
@source-hash: 6377b672b3f4ba8b
@generated: 2026-02-09T18:11:15Z

**Purpose**: Utility module providing formatting and debugging helpers for asyncio callbacks and stack traces. Part of the asyncio debugging infrastructure for improved error reporting and callback representation.

**Key Functions**:
- `_get_function_source(func)` (L10-19): Extracts source file path and line number from functions, handling wrapped functions, partials, and partial methods. Returns tuple (filename, line_number) or None.
- `_format_callback_source(func, args)` (L22-27): Combines callback formatting with source location information for debugging output.
- `_format_args_and_kwargs(args, kwargs)` (L30-41): Formats function arguments into readable string representation using reprlib for length limiting. Handles special case of single parameter formatting.
- `_format_callback(func, args, kwargs, suffix='')` (L44-59): Core callback formatting function that recursively handles functools.partial objects and generates human-readable callback representations with qualified names.
- `extract_stack(f=None, limit=None)` (L62-76): Optimized replacement for traceback.extract_stack() specifically designed for asyncio debug mode. Uses constants.DEBUG_STACK_DEPTH as default limit and disables line lookup for performance.

**Dependencies**:
- Standard library: functools, inspect, reprlib, sys, traceback
- Internal: `.constants` module (provides DEBUG_STACK_DEPTH)

**Key Patterns**:
- Recursive handling of functools.partial objects to unwrap nested partial applications
- Performance optimization in stack extraction by limiting depth and disabling line lookups
- Graceful fallback from __qualname__ to __name__ to repr() for function naming
- Use of reprlib for safe string representation with automatic truncation

**Critical Design Decisions**:
- Stack extraction is optimized for asyncio debug mode with reasonable limits to prevent performance degradation
- Callback formatting preserves partial application chains for complete debugging context
- Source location extraction handles various function wrapper types consistently