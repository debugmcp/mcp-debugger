# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/http/__init__.py
@source-hash: 17f4f6832cfc84b5
@generated: 2026-02-09T18:06:09Z

Python HTTP module initialization file providing standardized HTTP status codes and method enums for HTTP protocol handling.

## Core Components

### HTTPStatus Enum (L6-171)
IntEnum-based class providing comprehensive HTTP status code definitions with semantic properties:
- **Custom Constructor** (L26-32): Creates instances with `value`, `phrase`, and optional `description`
- **Category Properties** (L34-52): Boolean properties for status code classification
  - `is_informational` (L35-36): 100-199 range
  - `is_success` (L39-40): 200-299 range  
  - `is_redirection` (L43-44): 300-399 range
  - `is_client_error` (L47-48): 400-499 range
  - `is_server_error` (L51-52): 500-599 range

**Status Code Groups:**
- Informational (L55-59): CONTINUE, SWITCHING_PROTOCOLS, PROCESSING, EARLY_HINTS
- Success (L62-73): OK, CREATED, ACCEPTED, NO_CONTENT, etc.
- Redirection (L76-89): MULTIPLE_CHOICES, MOVED_PERMANENTLY, FOUND, etc.
- Client Error (L92-150): BAD_REQUEST, UNAUTHORIZED, FORBIDDEN, NOT_FOUND, etc.
- Server Error (L153-171): INTERNAL_SERVER_ERROR, NOT_IMPLEMENTED, BAD_GATEWAY, etc.

### HTTPMethod Enum (L174-200)
StrEnum-based class for HTTP method definitions:
- **Custom Constructor** (L183-187): Creates instances with `value` and `description`
- **Custom Repr** (L189-190): Clean string representation
- **Standard Methods** (L192-200): All major HTTP methods (GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS, CONNECT, TRACE)

## Key Features
- RFC-compliant status codes from multiple specifications (RFC 7231, 6585, 4918, etc.)
- Rich metadata with phrases and descriptions for each status/method
- Type-safe enum implementations using `@_simple_enum` decorator
- Semantic categorization through boolean properties
- Includes novelty codes like IM_A_TEAPOT (418) from RFC 2324

## Dependencies
- `enum.StrEnum, IntEnum, _simple_enum` for enum functionality
- Exports: `HTTPStatus`, `HTTPMethod` via `__all__`

## Usage Patterns
Status codes support both numeric comparison and semantic checking. Methods provide string values with descriptive metadata. Both enums extend base types (int/str) while adding rich attribute access.