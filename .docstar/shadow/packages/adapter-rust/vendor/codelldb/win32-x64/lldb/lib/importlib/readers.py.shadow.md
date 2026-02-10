# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/importlib/readers.py
@source-hash: d0d57d118d64916f
@generated: 2026-02-09T18:10:59Z

**Purpose**: Compatibility shim module that re-exports resource reader classes from `.resources.readers` to maintain backward compatibility with Python 3.10.

**Key Components**:
- Import statement (L8-10): Re-exports four core reader classes from the internal resources.readers module
- `__all__` declaration (L12): Explicitly defines the public API surface

**Exported Classes**:
- `FileReader`: File system-based resource reader
- `ZipReader`: ZIP archive resource reader  
- `MultiplexedPath`: Multi-source path handler
- `NamespaceReader`: Namespace package resource reader

**Architecture Pattern**: This is a compatibility facade that provides a stable API while the underlying implementation may have moved locations between Python versions. The module serves as an indirection layer, allowing consumers to import from this location regardless of internal restructuring.

**Dependencies**: 
- Internal dependency on `.resources.readers` module
- Part of the importlib package ecosystem

**Usage Context**: Intended for consumers who need to support Python 3.10 but want forward compatibility. Python 3.11+ users should import directly from the canonical location mentioned in the docstring.