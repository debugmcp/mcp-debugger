# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/ctypes/__init__.py
@source-hash: e0db1242e78267cb
@generated: 2026-02-09T18:10:48Z

Python ctypes module initialization - provides C data type interoperability and foreign function interface (FFI) capabilities for creating and manipulating C data types within Python environments. Part of LLDB debugging infrastructure in CodeLLDB adapter.

## Core Purpose
Primary interface module for Python's ctypes library, enabling:
- Creation and manipulation of C-compatible data types
- Dynamic library loading and function calling
- Memory management and pointer operations
- Cross-platform FFI with platform-specific optimizations

## Key Dependencies
- `_ctypes` (L8-15, L34-37): Core C extension providing base types and functionality
- `struct.calcsize` (L16): Size validation for type checking
- Platform modules: `os`, `sys` for platform detection and path handling

## Critical Type System

### Basic C Types (L166-253)
- Numeric types: `c_short`, `c_int`, `c_long`, `c_float`, `c_double` with platform-specific sizing
- Character types: `c_char`, `c_wchar`, `c_char_p`, `c_wchar_p`
- Pointer types: `c_void_p`, `py_object`
- Boolean: `c_bool`
- Size validation via `_check_size()` (L145-155) ensures struct compatibility

### Platform-Specific Adaptations (L182-222)
- Dynamic type aliasing based on platform integer sizes
- Conditional `c_longlong` creation if different from `c_long`
- Runtime size checking prevents libffi misconfigurations

## Function Prototyping System

### CFUNCTYPE Factory (L73-107)
Creates C function prototypes with caching mechanism (`_c_functype_cache`). Supports:
- Custom calling conventions via flags
- Error handling options (`use_errno`, `use_last_error`)
- Return type and argument specification

### WINFUNCTYPE (L114-136, Windows-only)
Windows stdcall variant with separate cache (`_win_functype_cache`) and `_FUNCFLAG_STDCALL` convention.

## Dynamic Library Loading

### CDLL Class (L322-401)
Primary DLL wrapper providing:
- Attribute-based function access (`__getattr__`, `__getitem__`)
- Platform-specific loading modes and path resolution
- Function pointer creation via internal `_FuncPtr` class
- Handle management and reference tracking

### Platform-Specific Loaders
- `PyDLL` (L402-407): Python API access without GIL release
- `WinDLL` (L411-415): Windows stdcall convention
- `OleDLL` (L433-440): Windows COM with HRESULT error handling

### LibraryLoader Pattern (L442-461)
Factory pattern for dynamic library discovery and caching, used by global instances `cdll`, `pydll`, `windll`, `oledll`.

## Buffer Management

### String Buffers (L49-70, L276-302)
- `create_string_buffer()`: Byte string buffers with audit logging
- `create_unicode_buffer()`: Unicode buffers with UTF-16/32 handling
- Automatic size calculation including null terminators

## Memory Operations (L501-537)
- `memmove`, `memset`: Low-level memory manipulation via CFUNCTYPE wrappers
- `string_at`, `wstring_at`: Memory reading utilities
- `cast()`: Type casting between C types

## Platform Configuration
- Mode selection (L21-32): macOS Darwin < 8 uses `RTLD_GLOBAL`, others default `RTLD_LOCAL`
- Windows-specific error handling via `FormatError` and `WinError`
- AIX archive member syntax support (L355-362)

## Type Size Mapping (L489-578)
Runtime detection of pointer-sized types for `c_size_t`/`c_ssize_t` and fixed-width integer types (`c_int8` through `c_int64`). Time type mapping based on `SIZEOF_TIME_T`.

## Cache Management
`_reset_cache()` (L265-274) clears function type caches and resets pointer parameter handling for proper cleanup during module reinitialization.

## Global API Objects
- `pythonapi`: Platform-specific Python C API access
- `cdll`, `pydll`, `windll`, `oledll`: Library loader instances
- Platform utilities: `GetLastError`, error handling functions