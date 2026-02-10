# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/struct.py
@source-hash: 9c231f9497caf513
@generated: 2026-02-09T18:09:06Z

## Purpose
Python struct module wrapper that provides a public API for binary data packing/unpacking operations. This is a thin interface layer over the C implementation in `_struct`.

## Public API Definition
- **__all__ (L1-11)**: Defines the complete public API surface including functions (`calcsize`, `pack`, `pack_into`, `unpack`, `unpack_from`, `iter_unpack`), classes (`Struct`), and exceptions (`error`)

## Implementation Details
- **Wildcard import (L13)**: `from _struct import *` - Imports all functionality from the C extension module `_struct`
- **Cache management (L14)**: Explicitly imports `_clearcache` function for internal cache clearing operations
- **Documentation (L15)**: Imports docstring from the C module

## Architecture Notes
This is a standard Python pattern where a pure-Python module serves as a public interface to a C extension module. The actual binary packing/unpacking logic is implemented in the `_struct` C extension for performance, while this module controls the public API surface and provides discoverability through `__all__`.

## Dependencies
- `_struct`: C extension module containing the actual implementation