# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/http/__init__.py
@source-hash: 17f4f6832cfc84b5
@generated: 2026-02-09T18:11:01Z

**Purpose**: HTTP constants library providing standard status codes and method enums for HTTP protocol implementation within the LLDB Python environment.

**Core Classes**:

- **HTTPStatus (L6-172)**: IntEnum subclass containing comprehensive HTTP status codes
  - Uses `@_simple_enum(IntEnum)` decorator pattern for enhanced enum functionality
  - Custom `__new__` method (L26-32) creates instances with value, phrase, and optional description
  - Classification properties (L34-52): `is_informational`, `is_success`, `is_redirection`, `is_client_error`, `is_server_error`
  - Comprehensive status code definitions organized by category:
    - Informational (100-199): CONTINUE, SWITCHING_PROTOCOLS, PROCESSING, EARLY_HINTS (L55-59)
    - Success (200-299): OK, CREATED, ACCEPTED, etc. (L62-73)
    - Redirection (300-399): MULTIPLE_CHOICES, MOVED_PERMANENTLY, FOUND, etc. (L76-89)
    - Client Error (400-499): BAD_REQUEST, UNAUTHORIZED, NOT_FOUND, etc. (L92-150)
    - Server Error (500-599): INTERNAL_SERVER_ERROR, NOT_IMPLEMENTED, etc. (L153-171)

- **HTTPMethod (L174-200)**: StrEnum subclass containing standard HTTP methods
  - Uses `@_simple_enum(StrEnum)` decorator pattern
  - Custom `__new__` method (L183-187) creates instances with method name and description
  - Custom `__repr__` method (L189-190) for string representation
  - Standard HTTP methods: CONNECT, DELETE, GET, HEAD, OPTIONS, PATCH, POST, PUT, TRACE (L192-200)

**Dependencies**:
- `enum` module: StrEnum, IntEnum, _simple_enum (L1)

**Key Features**:
- RFC compliance documentation in docstrings referencing multiple HTTP RFCs
- Rich metadata with phrases and descriptions for each status code/method
- Type-safe enum pattern with enhanced functionality through decorators
- Status code classification through boolean properties
- Exported public API via `__all__` (L3)

**Architectural Patterns**:
- Enum extension pattern using `_simple_enum` decorator
- Custom `__new__` methods for rich enum instances with multiple attributes
- Organized constant definitions with inline documentation
- Clear separation between status codes and methods as distinct enum types