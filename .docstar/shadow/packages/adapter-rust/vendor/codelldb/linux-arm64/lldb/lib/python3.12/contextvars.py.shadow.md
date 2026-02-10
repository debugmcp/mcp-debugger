# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/contextvars.py
@source-hash: 5ed260be8d1f4fe9
@generated: 2026-02-09T18:08:29Z

**Primary Purpose**: Pure import wrapper module that re-exports contextvars functionality from the native `_contextvars` C extension module, providing Python's context variable system for managing context-local state.

**Key Components**:
- Import statement (L1): Imports core contextvars classes and functions from the C extension
  - `Context`: Context object for managing variable scopes
  - `ContextVar`: Context variable class for storing context-local data
  - `Token`: Token returned by ContextVar.set() for restoration
  - `copy_context`: Function to copy current context state
- `__all__` declaration (L4): Defines public API exports matching imported symbols

**Dependencies**: 
- `_contextvars`: Native C extension module (CPython implementation)

**Architectural Pattern**: 
Standard Python library wrapper pattern - thin Python module that exposes C extension functionality through clean public interface. No additional logic or modification of imported behavior.

**Usage Context**: 
Part of Python 3.12 standard library in LLDB's embedded Python environment within CodeLLDB debugger adapter for Rust development on Linux ARM64.