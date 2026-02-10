# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/struct.py
@source-hash: 9c231f9497caf513
@generated: 2026-02-09T18:08:02Z

**Primary Purpose**: Python standard library `struct` module initialization file that provides binary data packing/unpacking functionality for LLDB's embedded Python environment.

**Architecture**: This is a thin wrapper module that re-exports all functionality from the compiled `_struct` C extension module. The module follows Python's common pattern of having a pure Python interface module that delegates to a C implementation.

**Key Components**:
- **Public API Definition** (L1-11): `__all__` list explicitly declares the module's public interface
- **Core Functions**: `calcsize`, `pack`, `pack_into`, `unpack`, `unpack_from`, `iter_unpack` - binary data conversion utilities
- **Struct Class**: `Struct` - compiled format string class for efficient repeated operations
- **Exception Type**: `error` - module-specific exception for format/data errors
- **C Extension Import** (L13-15): Imports all symbols from `_struct` C module plus internal cache management

**Dependencies**: 
- `_struct` (C extension) - provides the actual implementation
- Part of LLDB's bundled Python 3.12 standard library

**Usage Context**: Located in LLDB debugger's Python environment, used for binary protocol communication and data structure manipulation during debugging sessions.

**Critical Notes**: 
- All actual functionality resides in the C extension `_struct`
- `_clearcache` (L14) provides internal format string cache management
- This is a standard library module, not custom LLDB code