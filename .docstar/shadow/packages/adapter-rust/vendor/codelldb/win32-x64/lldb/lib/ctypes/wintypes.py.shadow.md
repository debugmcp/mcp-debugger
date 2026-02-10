# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/ctypes/wintypes.py
@source-hash: 5c4d9ba1a2168383
@generated: 2026-02-09T18:10:38Z

## Purpose
Windows datatypes wrapper for Python ctypes library. Provides comprehensive type definitions and structures that mirror Windows API data types, enabling Python code to interface with Windows system calls and libraries through ctypes.

## Key Components

### Basic Data Types (L4-29)
- **Primitive types**: BYTE, WORD, DWORD, CHAR, WCHAR, UINT, INT, DOUBLE, FLOAT
- **Boolean types**: BOOLEAN (alias to BYTE), BOOL (c_long), VARIANT_BOOL (L20-23) - custom class with "v" type for COM automation
- **Integer types**: ULONG, LONG, USHORT, SHORT with various bit widths

### Large Integer Types (L32-33)
- **LARGE_INTEGER/ULARGE_INTEGER**: 64-bit integer types for high-precision values, aliased to c_longlong/c_ulonglong

### String and Pointer Types (L35-38)
- **Unicode strings**: LPCOLESTR, LPOLESTR, OLESTR, LPCWSTR, LPWSTR (wide char pointers)
- **ANSI strings**: LPCSTR, LPSTR (char pointers) 
- **Void pointers**: LPCVOID, LPVOID for generic memory addresses

### Platform-Specific Types (L42-47)
- **WPARAM/LPARAM**: Message parameters with platform-dependent sizing logic
- Automatically selects c_ulong/c_long vs c_ulonglong/c_longlong based on pointer size

### Windows Handle Types (L60-92)
- **Base HANDLE**: Generic void pointer (L60)
- **Specific handles**: 30+ typed handles (HWND, HDC, HKEY, etc.) all aliasing HANDLE for type safety

### Structure Definitions

#### Geometric Structures
- **RECT (L97-101)**: Rectangle with left, top, right, bottom LONG fields
- **POINT (L115-117)**: 2D coordinate with x, y LONG fields  
- **SIZE (L120-122)**: Dimensions with cx, cy LONG fields
- **_SMALL_RECT (L104-108)**: Rectangle with SHORT coordinates
- **_COORD (L111-113)**: Simple coordinate pair with SHORT fields

#### System Structures
- **FILETIME (L128-130)**: 64-bit timestamp split into dwLowDateTime/dwHighDateTime DWORD fields
- **MSG (L133-139)**: Windows message structure containing hWnd, message, wParam, lParam, time, and pt fields
- **WIN32_FIND_DATAA/W (L143-165)**: File search result structures with ANSI/Unicode filename variants

### Utility Functions
- **RGB (L125-126)**: Color value constructor combining red, green, blue into single DWORD

### Pointer Type Definitions (L170-202)
Comprehensive pointer types for all basic types and structures using ctypes.POINTER(), following Windows naming conventions (LP*/P* prefixes).

## Architectural Patterns
- Extensive use of type aliases for Windows API compatibility
- Platform-aware pointer sizing for 32/64-bit compatibility  
- Separation of ANSI vs Unicode string/structure variants
- Consistent LP*/P* naming for pointer types
- Structure field definitions match Windows SDK layouts exactly

## Dependencies
- **ctypes**: Core Python C interop library for all type definitions and structure layouts

## Critical Notes
- VARIANT_BOOL uses custom "_SimpleCData" base with "v" type identifier for COM compatibility
- WPARAM/LPARAM sizing logic ensures correct pointer-width types across platforms
- All handle types are void pointers but maintain separate identities for type checking
- Structure layouts must match Windows SDK exactly for proper marshaling