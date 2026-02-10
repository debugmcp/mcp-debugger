# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/_osx_support.py
@source-hash: 363d3240acbba18a
@generated: 2026-02-09T18:12:49Z

**macOS Build System Support Module**

Provides platform-specific customization for Python build configuration on macOS/Darwin systems, handling universal builds, SDK detection, and compiler compatibility issues.

## Core Purpose
- Customizes Python build configuration variables for macOS environments 
- Handles universal binary builds and architecture selection
- Manages SDK availability and compiler detection
- Adapts configurations for different macOS/Xcode versions

## Key Functions

**System Information**
- `_get_system_version()` (L86-114): Parses macOS version from SystemVersion.plist, cached in `_SYSTEM_VERSION`
- `_get_system_version_tuple()` (L117-133): Converts version string to comparable tuple, cached in `_SYSTEM_VERSION_TUPLE`
- `_supports_universal_builds()` (L178-186): Returns True for macOS 10.4+
- `_supports_arm64_builds()` (L188-195): Returns True for macOS 11.0+ (arm64 support)

**Tool Discovery**
- `_find_executable(executable, path)` (L29-52): Locates executable in PATH, handles Windows .exe extension
- `_read_output(commandstring, capture_stderr)` (L55-74): Executes shell commands safely during bootstrap
- `_find_build_tool(toolname)` (L77-82): Finds build tools using PATH or xcrun

**Configuration Management**
- `_save_modified_value(_config_vars, cv, newvalue)` (L143-149): Preserves original values with `_INITPRE` prefix
- `_remove_original_values(_config_vars)` (L136-141): Cleanup helper for testing

**Compiler Detection & Customization**
- `_find_appropriate_compiler(_config_vars)` (L198-257): Locates suitable C compiler, prefers clang over llvm-gcc
- `_default_sysroot(cc)` (L153-176): Determines default SDK root by parsing compiler output

**Architecture & SDK Handling**
- `_remove_universal_flags(_config_vars)` (L260-271): Strips -arch and -isysroot flags
- `_remove_unsupported_archs(_config_vars)` (L274-311): Removes PPC architectures if unsupported
- `_override_all_archs(_config_vars)` (L314-328): Applies ARCHFLAGS environment variable
- `_check_for_unavailable_sdk(_config_vars)` (L331-355): Removes references to missing SDKs

## Public API

**Main Entry Points**
- `customize_config_vars(_config_vars)` (L438-476): Primary configuration customization, called by sysconfig
- `customize_compiler(_config_vars)` (L479-496): Compiler-specific customization for extension builds
- `compiler_fixup(compiler_so, cc_args)` (L358-435): Fixes compiler flags for universal builds
- `get_platform_osx(_config_vars, osname, release, machine)` (L499-579): Platform string generation with architecture detection

## Important Constants
- `_UNIVERSAL_CONFIG_VARS` (L17-20): Configuration variables affected by universal builds
- `_COMPILER_CONFIG_VARS` (L23): Variables containing compiler commands
- `_INITPRE` (L26): Prefix for storing original configuration values

## Architecture Detection Logic (L537-562)
Maps compiler flags to platform identifiers:
- Single arch: use arch name
- `('arm64', 'x86_64')`: 'universal2'
- `('i386', 'ppc')`: 'fat'
- `('i386', 'x86_64')`: 'intel' 
- Complex combinations: 'fat3', 'fat64', 'universal'

## Dependencies
- Standard library: `os`, `re`, `sys`, `contextlib`, `tempfile`
- Interacts with: distutils.sysconfig, system tools (xcrun, compiler executables)
- File system dependencies: SystemVersion.plist, /tmp directory, SDK paths