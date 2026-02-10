# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/ctypes/macholib/
@generated: 2026-02-09T18:16:07Z

## Purpose
This directory provides macOS dynamic library and framework resolution capabilities for Python applications. It implements the complete macOS `dyld` (dynamic linker/loader) search semantics, enabling Python code to locate frameworks and dylibs using the same algorithms as the native macOS dynamic linker.

## Key Components

### Core Modules
- **`dyld.py`**: Main module implementing macOS dyld search strategies and environment variable handling
- **`dylib.py`**: Utility module for parsing and extracting metadata from dynamic library paths

### Component Integration
The modules work together to provide a complete dyld emulation system:
1. `dylib.py` provides path parsing capabilities to extract version, suffix, and naming information from dylib paths
2. `dyld.py` uses this parsing capability within its search algorithms and implements the full dyld resolution chain
3. Together they replicate macOS's native library/framework discovery behavior in pure Python

## Public API Surface

### Primary Entry Points
- **`dyld_find(name, executable_path, env)`**: Main library/framework finder implementing complete dyld search chain
- **`framework_find(fn, executable_path, env)`**: Specialized framework finder with flexible input handling
- **`dylib_info(filename)`**: Parser for extracting structured metadata from dylib paths

### Environment Integration
- Complete DYLD environment variable support (DYLD_FRAMEWORK_PATH, DYLD_LIBRARY_PATH, etc.)
- Standard fallback path handling using macOS defaults
- Image suffix support for alternate library versions

## Internal Organization

### Search Strategy Architecture
Uses a layered search approach mirroring native dyld behavior:
1. **Override Search**: DYLD_FRAMEWORK_PATH and DYLD_LIBRARY_PATH environment variables
2. **Executable Path Search**: @executable_path/ relative references
3. **Default Search**: Standard system fallback locations
4. **Image Suffix Search**: Alternate versions with naming suffixes

### Data Flow
1. Input library/framework name enters through main API functions
2. Environment variables are parsed and applied as search path overrides
3. Multiple search strategies are chained using itertools for lazy evaluation
4. Path validation includes both filesystem checks and dyld shared cache lookup
5. Framework paths are parsed and normalized using regex-based analysis

## Important Patterns

### Design Conventions
- **Lazy Evaluation**: Generator-based search strategies for efficiency
- **Graceful Degradation**: Fallback mechanisms when native _ctypes functions unavailable
- **Environment Isolation**: Clean separation of environment variable handling
- **Exception-Based Control Flow**: Used strategically in framework_find for retry logic

### Integration Points
- Interfaces with native `_ctypes._dyld_shared_cache_contains_path` for performance
- Supports both framework and dylib resolution through unified API
- Compatible with standard macOS naming conventions and versioning schemes

This module serves as a critical bridge between Python applications and macOS's dynamic library system, particularly useful for tools that need to understand or replicate macOS dyld behavior without native system calls.