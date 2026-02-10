# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/_osx_support.py
@source-hash: 363d3240acbba18a
@generated: 2026-02-09T18:07:10Z

## Primary Purpose
macOS-specific build configuration utility for Python compilation/extension building. Handles compiler detection, architecture flags, SDK validation, and configuration variable customization to ensure compatibility across different macOS versions and Xcode installations.

## Key Functions

### System Detection & Utilities
- `_find_executable(executable, path=None)` (L29-52): Locates executables in PATH, handles Windows .exe extension
- `_read_output(commandstring, capture_stderr=False)` (L55-74): Executes shell commands safely during bootstrap (avoids subprocess dependency)
- `_find_build_tool(toolname)` (L77-82): Finds build tools via PATH or xcrun fallback
- `_get_system_version()` (L86-114): Parses macOS version from SystemVersion.plist, cached in global `_SYSTEM_VERSION`
- `_get_system_version_tuple()` (L117-133): Returns version as comparable tuple, cached in `_SYSTEM_VERSION_TUPLE`

### Configuration Variable Management
- `_save_modified_value(_config_vars, cv, newvalue)` (L143-149): Preserves original values with `_OSX_SUPPORT_INITIAL_` prefix before modification
- `_remove_original_values(_config_vars)` (L136-141): Cleanup utility for testing

### Compiler & SDK Handling
- `_find_appropriate_compiler(_config_vars)` (L198-257): Locates working compiler (clang preferred over llvm-gcc), respects CC env var
- `_default_sysroot(cc)` (L153-176): Determines default SDK root by parsing compiler include paths, cached globally
- `_check_for_unavailable_sdk(_config_vars)` (L331-355): Removes -isysroot flags for non-existent SDKs

### Architecture Support
- `_supports_universal_builds()` (L178-186): True if macOS >= 10.4 (universal build capability)
- `_supports_arm64_builds()` (L188-195): True if macOS >= 11.0 (Apple Silicon support)
- `_remove_universal_flags(_config_vars)` (L260-271): Strips all -arch/-isysroot flags via regex
- `_remove_unsupported_archs(_config_vars)` (L274-311): Tests/removes PPC architecture flags on incompatible systems
- `_override_all_archs(_config_vars)` (L314-328): Applies ARCHFLAGS environment variable override

### Public API
- `compiler_fixup(compiler_so, cc_args)` (L358-435): **Primary entry point** - strips conflicting -arch/-isysroot flags, validates SDK existence
- `customize_config_vars(_config_vars)` (L438-476): **Entry point from sysconfig** - customizes build vars for runtime environment
- `customize_compiler(_config_vars)` (L479-496): **Entry point for extension builds** - full compiler/arch customization
- `get_platform_osx(_config_vars, osname, release, machine)` (L499-578): **Platform string generation** - determines architecture tags (fat, intel, universal2, etc.)

## Key Constants
- `_UNIVERSAL_CONFIG_VARS` (L17-20): Build variables that may contain -arch/-isysroot flags
- `_COMPILER_CONFIG_VARS` (L23): Variables containing compiler commands
- `_INITPRE` (L26): Prefix for preserving original variable values

## Architecture Detection Logic (L537-578)
Maps architecture combinations to platform tags:
- `('arm64', 'x86_64')` → 'universal2' (Apple Silicon + Intel)
- `('i386', 'ppc')` → 'fat'
- `('i386', 'x86_64')` → 'intel'
- Plus fat3, fat64, universal variants

## Dependencies
- Standard library only: `os`, `re`, `sys`
- Uses manual file I/O and `os.system()` to avoid bootstrap dependency issues
- Integrates with `distutils.sysconfig` and `sysconfig` modules

## Critical Constraints
- Must work during Python bootstrap (no subprocess, limited tempfile)
- Respects environment variable overrides (CC, ARCHFLAGS)
- Maintains backward compatibility across macOS/Xcode versions
- Handles missing SDKs gracefully by falling back to system paths