# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/wsgiref/types.py
@source-hash: ba66d30ce511a88e
@generated: 2026-02-09T18:11:17Z

**Primary Purpose**: Provides static type definitions for WSGI (Web Server Gateway Interface) components as specified in PEP 3333, enabling type checking for Python web applications and servers.

**Key Type Definitions**:
- `_ExcInfo` (L16): Exception info tuple type for active exceptions
- `_OptExcInfo` (L17): Optional exception info allowing None values
- `StartResponse` (L19-27): Protocol defining the WSGI start_response callable signature
- `WSGIEnvironment` (L29): Type alias for WSGI environment dictionary
- `WSGIApplication` (L30-31): Type alias for WSGI application callable
- `InputStream` (L33-38): Protocol for WSGI input streams with read operations
- `ErrorStream` (L40-44): Protocol for WSGI error streams with write operations
- `_Readable` (L46-48): Internal protocol for readable file-like objects
- `FileWrapper` (L50-54): Protocol for WSGI file wrapper callables

**Architectural Patterns**:
- Uses Protocol classes for structural typing instead of inheritance
- Leverages TypeAlias for semantic clarity and reusability
- Follows PEP 3333 WSGI specification strictly
- Uses positional-only parameters (/) for protocol methods

**Dependencies**:
- `collections.abc`: For Callable, Iterable, Iterator types
- `types.TracebackType`: For exception traceback typing
- `typing`: For Protocol and TypeAlias constructs

**Critical Constraints**:
- All protocols must match PEP 3333 WSGI specification exactly
- StartResponse must return a callable that accepts bytes
- Environment must be a string-keyed dictionary
- Input/output streams use bytes, error streams use strings