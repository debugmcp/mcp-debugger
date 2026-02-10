# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/wsgiref/types.py
@source-hash: ba66d30ce511a88e
@generated: 2026-02-09T18:06:05Z

**Primary Purpose**: Type definitions for WSGI (Web Server Gateway Interface) static type checking, implementing PEP 3333 protocol specifications.

**Key Type Definitions**:
- `_ExcInfo` (L16): Exception info tuple type alias for `(exception_type, exception_value, traceback)`
- `_OptExcInfo` (L17): Optional exception info, either `_ExcInfo` or `(None, None, None)`
- `WSGIEnvironment` (L29): Type alias for WSGI environment dictionary `dict[str, Any]`
- `WSGIApplication` (L30-31): Type alias for WSGI application callable signature

**Protocol Classes**:
- `StartResponse` (L19-27): Protocol for WSGI start_response callable
  - Takes status string, headers list, optional exception info
  - Returns callable that accepts bytes and returns object
- `InputStream` (L33-38): WSGI input stream protocol with read operations
  - Methods: `read()`, `readline()`, `readlines()`, `__iter__()`
- `ErrorStream` (L40-44): WSGI error stream protocol for writing errors
  - Methods: `flush()`, `write()`, `writelines()`
- `_Readable` (L46-48): Internal protocol for file-like readable objects
- `FileWrapper` (L50-54): WSGI file wrapper protocol for efficient file serving

**Dependencies**: 
- `collections.abc` for `Callable`, `Iterable`, `Iterator`
- `types.TracebackType` for exception handling
- `typing` module for Protocol and TypeAlias

**Architectural Notes**:
- All protocols follow PEP 3333 WSGI specification
- Uses modern Python typing features (Protocol, TypeAlias, positional-only parameters)
- Designed for static type checking, not runtime enforcement
- Exports all major types via `__all__` for clean public API