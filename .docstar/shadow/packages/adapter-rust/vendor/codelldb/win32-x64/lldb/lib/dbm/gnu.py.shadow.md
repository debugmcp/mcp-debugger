# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/dbm/gnu.py
@source-hash: 36cd4904f50e00c4
@generated: 2026-02-09T18:10:22Z

## Purpose
Thin wrapper module that exposes the `_gdbm` (GNU DBM) C extension as a dbm submodule, providing GNU database manager functionality within the LLDB debugger's Python environment.

## Structure
- **Module-level import (L3)**: Wildcard import from `_gdbm` - exposes all GNU DBM functions and classes
- **Docstring (L1)**: Brief description of module's bridging purpose

## Dependencies
- `_gdbm`: Core GNU DBM C extension module providing low-level database operations

## Context
Located within LLDB's bundled Python environment (`packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/dbm/`), this module enables LLDB's Python scripting to access GNU-style database files. Part of Python's standard dbm package architecture where different database backends are exposed through consistent interfaces.

## Key Characteristics
- Minimal wrapper with no additional logic
- Follows Python's dbm module pattern for database backend abstraction
- Platform-specific (win32-x64) LLDB integration