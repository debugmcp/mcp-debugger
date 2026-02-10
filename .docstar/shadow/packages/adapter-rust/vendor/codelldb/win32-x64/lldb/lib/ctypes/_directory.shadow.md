# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/ctypes/
@generated: 2026-02-09T18:16:42Z

## Purpose
This directory provides comprehensive C Foreign Function Interface (FFI) capabilities for Python, enabling creation, manipulation, and platform-specific optimization of C data types and dynamic library interactions. Part of LLDB debugging infrastructure in CodeLLDB adapter, this is a complete ctypes implementation supporting cross-platform binary data handling and library loading.

## Core Architecture

### Main Entry Point (`__init__.py`)
Primary interface module providing the complete ctypes API surface:
- **C Data Types**: Full spectrum of C-compatible types (`c_int`, `c_char`, `c_void_p`, etc.) with platform-specific sizing
- **Function Prototyping**: `CFUNCTYPE`/`WINFUNCTYPE` factories with calling convention support and caching
- **Dynamic Library Loading**: `CDLL`, `PyDLL`, `WinDLL`, `OleDLL` classes providing platform-optimized library access
- **Memory Management**: Buffer creation, pointer operations, and low-level memory manipulation
- **Global API Objects**: `cdll`, `windll`, `pythonapi` instances for immediate library access

### Platform Specialization Layer
Platform-specific modules handle unique system requirements:
- **`_aix.py`**: AIX dual library format system (XCOFF archives vs SVR4 shared objects) with archive member selection
- **`util.py`**: Cross-platform library discovery using native tools (ldconfig, gcc, objdump, crle) and system-specific search strategies
- **`wintypes.py`**: Complete Windows API datatype definitions and structures for system call compatibility
- **`macholib/`**: macOS dyld search emulation with framework and dynamic library resolution

### Data Format Support
- **`_endian.py`**: Byte order handling with metaclass-based field transformation for cross-platform binary compatibility
- Automatic endianness detection and structure swapping capabilities

## Component Integration

### Library Discovery Pipeline
1. **`util.find_library(name)`**: Main entry point dispatches to platform-specific discovery mechanisms
2. **Platform handlers**: Use native system tools and configuration files to locate libraries
3. **Result validation**: ELF/format checking and ABI compatibility verification
4. **Library loading**: Results fed into CDLL-family classes for actual loading

### Type System Integration
1. **Basic types**: Platform-aware sizing with runtime validation via `_check_size()`
2. **Endianness support**: Automatic structure field transformation for non-native byte orders
3. **Windows integration**: Complete Windows SDK type compatibility through `wintypes.py`
4. **Function binding**: Type-aware function pointer creation with calling convention handling

### Cross-Platform Abstraction
- **Conditional loading**: Platform detection drives module selection and feature availability
- **Graceful degradation**: Fallback mechanisms when platform tools unavailable
- **Environment integration**: DYLD variables (macOS), LD_LIBRARY_PATH (Unix), PATH (Windows)

## Public API Surface

### Primary Entry Points
- **`find_library(name)`**: Universal library discovery across all supported platforms
- **`CDLL(name)`**: Load shared library with attribute-based function access
- **`CFUNCTYPE(restype, *argtypes)`**: Create C function prototypes with type safety
- **Basic C types**: `c_int`, `c_char_p`, `c_void_p`, etc. for data marshaling
- **Buffer creation**: `create_string_buffer()`, `create_unicode_buffer()` for memory allocation

### Platform-Specific APIs
- **Windows**: `WinDLL`, `windll`, complete Windows datatype set via `wintypes`
- **macOS**: Framework discovery through `macholib.dyld_find()` and `framework_find()`
- **AIX**: Archive member resolution with version selection and legacy format support

## Internal Organization

### Caching and Performance
- Function type caching (`_c_functype_cache`, `_win_functype_cache`) for prototype reuse
- Library loader caching in `LibraryLoader` pattern
- macOS dyld shared cache integration for performance optimization

### Memory and Resource Management
- Automatic cleanup via `_reset_cache()` during module reinitialization
- Reference counting for loaded libraries and function pointers
- Buffer lifecycle management with audit logging support

### Error Handling
- Platform-specific error reporting (`FormatError`, `WinError`, `GetLastError`)
- Type validation with comprehensive size checking
- Graceful fallbacks when system dependencies unavailable

## Critical Design Patterns

### Lazy Evaluation
- Generator-based search strategies in library discovery
- Deferred loading of platform-specific modules
- On-demand function pointer creation

### Platform Polymorphism
- Single API surface with platform-specific backend implementations
- Conditional class definitions based on runtime platform detection
- Dynamic tool discovery with multiple fallback strategies

This module serves as the complete FFI foundation for Python applications needing C library integration, with particular emphasis on debugging tools and system-level programming where precise control over memory layout and calling conventions is essential.