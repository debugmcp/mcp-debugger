# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/ctypes/macholib/dyld.py
@source-hash: eb8e7b17f1533bc3
@generated: 2026-02-09T18:06:13Z

**Purpose**: macOS dyld (dynamic linker/loader) emulation for finding frameworks and dynamic libraries using Apple's dyld search semantics. This module provides Python implementations of the library/framework resolution algorithms used by macOS's dynamic linker.

**Key Constants**:
- `DEFAULT_FRAMEWORK_FALLBACK` (L22-27): Standard macOS framework search paths including user, system, and network locations
- `DEFAULT_LIBRARY_FALLBACK` (L29-34): Standard library search paths in hierarchical order

**Environment Variable Accessors**:
- `dyld_env(env, var)` (L36-42): Generic DYLD environment variable parser, splits colon-separated paths
- `dyld_image_suffix(env)` (L44-47): Gets DYLD_IMAGE_SUFFIX for alternate library versions
- `dyld_framework_path(env)` (L49-50): Retrieves DYLD_FRAMEWORK_PATH override directories
- `dyld_library_path(env)` (L52-53): Retrieves DYLD_LIBRARY_PATH override directories
- `dyld_fallback_framework_path(env)` (L55-56): Gets fallback framework search paths
- `dyld_fallback_library_path(env)` (L58-59): Gets fallback library search paths

**Search Strategy Functions**:
- `dyld_image_suffix_search(iterator, env)` (L61-73): Applies image suffix transformation to paths, yielding both suffixed and original versions
- `dyld_override_search(name, env)` (L75-90): Implements DYLD_FRAMEWORK_PATH and DYLD_LIBRARY_PATH override logic
- `dyld_executable_path_search(name, executable_path)` (L92-97): Resolves @executable_path/ relative references
- `dyld_default_search(name, env)` (L99-119): Implements standard dyld fallback search with framework/library distinction

**Core API Functions**:
- `dyld_find(name, executable_path, env)` (L121-139): Main library/framework finder using complete dyld search chain. Uses itertools.chain to combine search strategies and checks both filesystem and shared cache via `_dyld_shared_cache_contains_path`
- `framework_find(fn, executable_path, env)` (L141-163): Specialized framework finder with flexible input handling (bare names, .framework extensions, version paths)

**Dependencies**:
- `ctypes.macholib.framework.framework_info`: Framework path parsing
- `ctypes.macholib.dylib.dylib_info`: Dynamic library information
- `_ctypes._dyld_shared_cache_contains_path`: Native function for shared cache lookup (with fallback)
- `itertools`: For chaining search strategies

**Architecture Notes**:
- Implements lazy evaluation through generator functions for efficient path searching
- Mirrors actual macOS dyld behavior including environment variable precedence
- Gracefully handles missing native _ctypes functionality
- Uses exception handling for control flow in framework_find retry logic