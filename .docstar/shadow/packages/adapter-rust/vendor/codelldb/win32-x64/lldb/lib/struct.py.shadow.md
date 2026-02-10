# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/struct.py
@source-hash: 9c231f9497caf513
@generated: 2026-02-09T18:13:04Z

## Purpose
Python struct module interface wrapper that provides binary data packing/unpacking functionality. This is a standard library compatibility shim that re-exports the native `_struct` module's functionality.

## Key Components

### Exports (L1-11)
- **Functions**: `calcsize`, `pack`, `pack_into`, `unpack`, `unpack_from`, `iter_unpack` - Binary data conversion utilities
- **Classes**: `Struct` - Object-oriented interface for format string operations
- **Exceptions**: `error` - Struct operation error handling

### Module Structure (L13-15)
- **Wildcard Import (L13)**: Re-exports all public symbols from native `_struct` module
- **Explicit Imports (L14-15)**: Brings in `_clearcache` function and module docstring from `_struct`

## Dependencies
- **_struct**: Native C extension module providing core binary data manipulation functionality

## Architecture Notes
This is a thin wrapper/compatibility layer over the native `_struct` module. The `__all__` list explicitly controls the public API surface, while the wildcard import ensures all native functionality is available. The explicit import of `_clearcache` suggests this internal function needs special handling outside the wildcard import pattern.

## Usage Context
Part of LLDB Python bindings distribution, likely used for binary protocol communication or data structure serialization within the debugger ecosystem.