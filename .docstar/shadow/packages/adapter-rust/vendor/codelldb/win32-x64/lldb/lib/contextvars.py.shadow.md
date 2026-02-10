# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/contextvars.py
@source-hash: 5ed260be8d1f4fe9
@generated: 2026-02-09T18:14:14Z

## Purpose
Pure import wrapper module that re-exports the contextvars implementation from the internal `_contextvars` C extension module. Provides the public API surface for Python's contextvars functionality within the LLDB Python environment.

## Key Exports
- **Context, ContextVar, Token, copy_context** (L1): Core contextvars primitives imported from the private `_contextvars` module
- **__all__** (L4): Explicitly defines the public API surface, ensuring only these four symbols are exported during `from contextvars import *`

## Dependencies
- `_contextvars`: Private C extension module containing the actual contextvars implementation

## Architecture Notes
This is a standard Python library facade pattern - the real implementation lives in the private `_contextvars` C module, while this file provides the clean public interface. This pattern is common in Python standard library modules that have C implementations for performance.

## Usage Context
Located within LLDB's embedded Python environment (`lldb/lib/`), suggesting this provides contextvars support for LLDB's Python scripting capabilities. The contextvars module enables context-local state management across async boundaries and thread boundaries.