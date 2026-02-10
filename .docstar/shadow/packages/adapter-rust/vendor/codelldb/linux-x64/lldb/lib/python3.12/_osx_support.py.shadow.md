# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/_osx_support.py
@source-hash: 363d3240acbba18a
@generated: 2026-02-09T18:10:25Z

## Primary Purpose
macOS/OS X build system support utilities for Python's distutils/sysconfig. Handles cross-platform compilation challenges specific to macOS including universal builds, architecture detection, SDK management, and compiler toolchain discovery. Despite being in a Linux path, this module targets macOS build environments.

## Key Constants & Configuration (L7-26)
- `_UNIVERSAL_CONFIG_VARS` (L17-20): Configuration variables that may contain universal build flags like `-arch` or `-isysroot`
- `_COMPILER_CONFIG_VARS` (L23): Variables containing compiler command definitions
- `_INITPRE` (L26): Prefix for storing original configuration values before modification

## Core System Detection (L84-196)
- `_get_system_version()` (L86-114): Parses `/System/Library/CoreServices/SystemVersion.plist` to extract macOS version string, cached in `_SYSTEM_VERSION`
- `_get_system_version_tuple()` (L117-133): Converts version string to comparable tuple format
- `_supports_universal_builds()` (L178-186): Checks if system supports universal builds (macOS 10.4+)
- `_supports_arm64_builds()` (L188-195): Validates arm64 architecture support (macOS 11.0+)

## Utility Functions (L29-83)
- `_find_executable()` (L29-52): Cross-platform executable finder with Windows `.exe` handling
- `_read_output()` (L55-74): Executes shell commands and captures output, handles bootstrap scenarios where tempfile unavailable
- `_find_build_tool()` (L77-82): Locates build tools via PATH or xcrun fallback

## Compiler Management (L152-257)
- `_default_sysroot()` (L153-176): Determines system root by parsing compiler include paths, cached globally
- `_find_appropriate_compiler()` (L198-257): Core compiler detection logic - handles Xcode location variations, prefers clang over LLVM-GCC, updates config vars with found compiler

## Configuration Variable Management (L136-149)
- `_save_modified_value()` (L143-149): Preserves original values before modification using `_INITPRE` prefix
- `_remove_original_values()` (L136-141): Testing utility to clean backup values

## Architecture & SDK Processing (L260-355)
- `_remove_universal_flags()` (L260-271): Strips `-arch` and `-isysroot` flags from config variables
- `_remove_unsupported_archs()` (L274-311): Tests and removes unsupported PPC architectures via compilation probe
- `_override_all_archs()` (L314-328): Applies `ARCHFLAGS` environment variable overrides
- `_check_for_unavailable_sdk()` (L331-355): Validates SDK paths and removes invalid `-isysroot` references

## Public API Functions (L358-579)
- `compiler_fixup()` (L358-435): Processes compiler command lists to handle architecture and sysroot conflicts, validates SDK existence
- `customize_config_vars()` (L438-476): Entry point for basic configuration customization during sysconfig initialization
- `customize_compiler()` (L479-496): Entry point for compiler-specific customization during first extension build
- `get_platform_osx()` (L499-579): Generates platform strings with complex architecture detection logic supporting fat/universal/intel variants

## Dependencies
- Standard library: `os`, `re`, `sys` for system interaction
- Runtime imports: `tempfile`, `contextlib` (with fallback handling)
- Integration: Works with distutils.sysconfig and distutils.util

## Critical Invariants
- Preserves original config values before modification for testing/rollback
- Respects environment variable overrides (`CC`, `ARCHFLAGS`, `MACOSX_DEPLOYMENT_TARGET`)
- Handles bootstrap scenarios where standard library modules unavailable
- Caches expensive operations (system version, default sysroot) globally