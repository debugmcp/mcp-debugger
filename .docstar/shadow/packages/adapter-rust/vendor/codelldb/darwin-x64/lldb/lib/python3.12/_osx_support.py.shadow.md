# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/_osx_support.py
@source-hash: 363d3240acbba18a
@generated: 2026-02-09T18:07:40Z

## OSX Support Module for Python Build System

**Purpose**: Provides macOS-specific utilities for Python's build configuration, handling cross-platform compatibility issues, compiler detection, architecture flags, and SDK management during Python extension compilation.

### Core Functionality Areas

**System Detection & Version Management**
- `_get_system_version()` (L86-114): Reads macOS version from SystemVersion.plist, cached globally in `_SYSTEM_VERSION`
- `_get_system_version_tuple()` (L117-133): Returns version as comparable tuple, cached in `_SYSTEM_VERSION_TUPLE`
- `_supports_universal_builds()` (L178-186): Checks if system supports universal builds (macOS 10.4+)
- `_supports_arm64_builds()` (L188-195): Checks ARM64 support (macOS 11.0+)

**Tool & Executable Discovery**
- `_find_executable()` (L29-52): Cross-platform executable finder with Windows .exe handling
- `_find_build_tool()` (L77-82): Finds build tools via PATH or xcrun
- `_read_output()` (L55-74): Executes shell commands safely during bootstrap (avoids subprocess dependency)

**Compiler Management**
- `_find_appropriate_compiler()` (L198-257): Intelligent compiler detection, prefers clang over gcc/llvm-gcc, handles Xcode variations
- `_default_sysroot()` (L153-176): Determines default SDK root by parsing compiler include paths
- `compiler_fixup()` (L358-435): Strips conflicting architecture and sysroot flags from compiler command lines

**Configuration Variables Handling**
- Configuration var categories: `_UNIVERSAL_CONFIG_VARS` (L17-20), `_COMPILER_CONFIG_VARS` (L23)
- `_save_modified_value()` (L143-149): Preserves original values with `_INITPRE` prefix before modification
- `_remove_original_values()` (L136-141): Cleanup utility for testing

**Architecture & Build Flag Processing**
- `_remove_universal_flags()` (L260-271): Strips all -arch and -isysroot flags
- `_remove_unsupported_archs()` (L274-311): Removes PPC architectures on newer systems
- `_override_all_archs()` (L314-328): Applies ARCHFLAGS environment variable
- `_check_for_unavailable_sdk()` (L331-355): Removes references to non-existent SDKs

### Public API Functions

**`customize_config_vars(_config_vars)`** (L438-476): Main configuration customization entry point, applies universal build removal, architecture overrides, and SDK validation.

**`customize_compiler(_config_vars)`** (L479-496): Compiler-specific customization for extension builds, handles compiler detection and architecture cleanup.

**`get_platform_osx(_config_vars, osname, release, machine)`** (L499-579): Generates platform string for macOS, handles universal binary detection and machine type normalization (e.g., 'intel', 'universal2', 'fat3').

### Key Constants & Caching
- Global caches: `_SYSTEM_VERSION` (L84), `_SYSTEM_VERSION_TUPLE` (L116), `_cache_default_sysroot` (L152)
- Prefix for original values: `_INITPRE = '_OSX_SUPPORT_INITIAL_'` (L26)

### Dependencies
- Standard library: `os`, `re`, `sys`
- Runtime imports: `tempfile`, `contextlib` (imported conditionally during bootstrap)

### Architecture Mapping Logic (L543-562)
Maps architecture combinations to platform identifiers:
- `('arm64', 'x86_64')` → 'universal2'
- `('i386', 'x86_64')` → 'intel' 
- `('i386', 'ppc', 'ppc64', 'x86_64')` → 'universal'

This module is critical for Python's distutils/sysconfig system on macOS, handling the complexity of Apple's evolving toolchain and architecture support.