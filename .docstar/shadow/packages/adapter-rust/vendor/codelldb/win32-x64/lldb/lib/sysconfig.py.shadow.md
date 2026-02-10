# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/sysconfig.py
@source-hash: 11422a6dbcaa7e46
@generated: 2026-02-09T18:13:20Z

# sysconfig.py - Python Configuration Information Access Module

**Primary Purpose**: Provides standardized access to Python installation paths, configuration variables, and build-time settings across different platforms (Windows, POSIX, macOS).

## Core Data Structures

**_INSTALL_SCHEMES (L27-99)**: Dictionary defining installation path templates for different platforms and contexts:
- `posix_prefix`, `posix_home`, `nt` - Standard platform schemes
- `posix_venv`, `nt_venv`, `venv` - Virtual environment schemes  
- `nt_user`, `posix_user`, `osx_framework_user` - User-local installation schemes

**_SCHEME_KEYS (L166-167)**: Tuple defining standard path categories: `stdlib`, `platstdlib`, `purelib`, `platlib`, `include`, `scripts`, `data`

## Key Configuration Variables (L169-181)
- **_PY_VERSION** (L169): Full Python version string
- **_PY_VERSION_SHORT** (L170): Short version (e.g., "3.11")
- **_PREFIX/_EXEC_PREFIX** (L172-175): Installation base paths
- **_CONFIG_VARS** (L178): Global configuration dictionary (thread-safe with _CONFIG_VARS_LOCK)
- **_PROJECT_BASE** (L196-222): Python installation root directory

## Public API Functions

### Path Resolution
- **get_paths()** (L619-628): Returns complete path mapping for installation scheme
- **get_path()** (L631-636): Returns single path from scheme
- **get_scheme_names()** (L609-611): Available installation schemes
- **get_path_names()** (L614-616): Available path categories

### Configuration Access  
- **get_config_vars()** (L704-731): Thread-safe access to build configuration variables
- **get_config_var()** (L734-740): Single configuration variable access
- **get_platform()** (L743-821): Platform identification string generation

### File Parsing
- **parse_config_h()** (L563-594): Parses C preprocessor defines from pyconfig.h
- **_parse_makefile()** (L320-445): Complex Makefile parser with variable interpolation

## Platform-Specific Initialization

### POSIX Systems
- **_init_posix()** (L532-538): Loads build-time variables from _sysconfigdata module
- **_generate_posix_vars()** (L469-530): Generates sysconfigdata module during build

### Windows Systems  
- **_init_non_posix()** (L540-556): Sets Windows-specific paths and variables

## Critical Implementation Details

### Variable Interpolation (L249-281)
- **_subst_vars()** (L249-256): Template string substitution with fallback to environment
- **_expand_vars()** (L266-281): Expands installation scheme templates with configuration variables

### User Base Detection (L110-132)
- **_getuserbase()**: Platform-aware user installation directory detection
- Handles special cases: Emscripten, VxWorks, WASI, macOS frameworks

### Thread Safety
- Uses **_CONFIG_VARS_LOCK** (L177) RLock for thread-safe configuration initialization
- Double-checked locking pattern in get_config_vars() (L715-723)

## Architectural Patterns
- **Lazy initialization**: Configuration loaded on first access
- **Platform abstraction**: Unified API across OS differences  
- **Template-based paths**: String formatting for flexible path generation
- **Fallback mechanisms**: Environment variables override build-time settings

## Dependencies
- **Standard library**: os, sys, threading, re
- **Platform modules**: _imp, _osx_support, _aix_support
- **Build-time module**: _sysconfigdata (dynamically imported)

## Entry Point
- **_main()** (L861-872): CLI interface for displaying configuration information
- **--generate-posix-vars** flag triggers build-time variable generation