# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/struct.py
@source-hash: 9c231f9497caf513
@generated: 2026-02-09T18:07:13Z

**Primary Purpose**: Python struct module wrapper that provides binary data packing/unpacking functionality for LLDB's Python environment.

**Module Structure**:
- **Public API Export (L1-11)**: Defines `__all__` list exposing 7 core identifiers:
  - Functions: `calcsize`, `pack`, `pack_into`, `unpack`, `unpack_from`, `iter_unpack`
  - Classes: `Struct`
  - Exceptions: `error`

**Implementation Pattern**:
- **Star Import (L13)**: Imports all symbols from C extension module `_struct`
- **Explicit Imports (L14-15)**: Selectively imports `_clearcache` function and `__doc__` attribute from `_struct`

**Architecture**:
This is a thin Python wrapper around the C-based `_struct` module, following Python's standard pattern of exposing C extension functionality through a pure Python interface. The module provides binary data serialization capabilities essential for LLDB's debugging operations.

**Dependencies**:
- `_struct`: Core C extension module providing the actual implementation

**Usage Context**:
Part of LLDB's embedded Python environment on Darwin ARM64, enabling binary data manipulation during debugging sessions. The struct module is crucial for interpreting binary data formats in debugged processes.