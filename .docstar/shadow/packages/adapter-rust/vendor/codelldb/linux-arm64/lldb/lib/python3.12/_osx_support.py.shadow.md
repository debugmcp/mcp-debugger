# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/_osx_support.py
@source-hash: 363d3240acbba18a
@generated: 2026-02-09T18:08:32Z

## Purpose
macOS-specific build configuration utilities for Python distutils/sysconfig. Handles compiler detection, architecture flags, SDK paths, and universal build support across different macOS versions and Xcode configurations.

## Key Components

### Version Detection
- `_get_system_version()` (L86-114): Reads macOS version from SystemVersion.plist, returns major.minor format
- `_get_system_version_tuple()` (L117-133): Returns version as comparable tuple for version checks
- Global caching via `_SYSTEM_VERSION` (L84) and `_SYSTEM_VERSION_TUPLE` (L116)

### Utility Functions
- `_find_executable()` (L29-52): Cross-platform executable finder with Windows .exe handling
- `_read_output()` (L55-74): Command execution with temporary file fallback for bootstrap environments
- `_find_build_tool()` (L77-82): Locates build tools via PATH or xcrun
- `_default_sysroot()` (L153-176): Determines SDK root by parsing compiler include paths

### Architecture/Build Support
- `_supports_universal_builds()` (L178-186): Checks if system supports -arch/-isysroot (macOS 10.4+)
- `_supports_arm64_builds()` (L188-195): Validates ARM64 support (macOS 11.0+)

### Configuration Variable Management
- `_save_modified_value()` (L143-149): Preserves original values with `_OSX_SUPPORT_INITIAL_` prefix
- `_remove_original_values()` (L136-141): Cleanup utility for testing

### Compiler Management
- `_find_appropriate_compiler()` (L198-257): Intelligent compiler detection (clang fallback from gcc/llvm-gcc)
- `compiler_fixup()` (L358-435): Strips conflicting -arch/-isysroot flags from compiler commands

### Architecture Flag Processing
- `_remove_universal_flags()` (L260-271): Strips all -arch and -isysroot flags
- `_remove_unsupported_archs()` (L274-311): Tests and removes unsupported PPC architectures
- `_override_all_archs()` (L314-328): Applies ARCHFLAGS environment variable

### SDK Validation
- `_check_for_unavailable_sdk()` (L331-355): Removes references to missing SDK paths

## Public API Functions

### `customize_config_vars(_config_vars)` (L438-476)
Primary configuration customization for distutils.sysconfig. Handles:
- Universal build flag removal for pre-10.4 systems
- ARCHFLAGS environment variable processing
- Missing SDK cleanup

### `customize_compiler(_config_vars)` (L479-496)
Compiler-specific customization for extension builds:
- Compiler detection and replacement
- Unsupported architecture removal
- Architecture override processing

### `get_platform_osx(_config_vars, osname, release, machine)` (L499-579)
Platform string generation for distribution compatibility:
- Uses MACOSX_DEPLOYMENT_TARGET when available
- Maps architecture combinations to platform names (universal2, intel, fat, etc.)
- Handles machine type detection for i386/x86_64 and PowerPC variants

## Constants
- `_UNIVERSAL_CONFIG_VARS` (L17-20): Configuration variables containing architecture flags
- `_COMPILER_CONFIG_VARS` (L23): Variables containing compiler commands
- `_INITPRE` (L26): Prefix for preserved original values

## Dependencies
- Standard library: os, re, sys, contextlib
- Optional: tempfile (with /tmp fallback)
- External tools: xcrun, compiler commands

## Architecture Decisions
- Bootstrap-safe implementation avoiding subprocess/os.popen
- Graceful fallbacks for missing tools/SDKs
- Caching for expensive system queries
- Environment variable override support throughout