# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/ctypes/util.py
@source-hash: a54310b64a080b01
@generated: 2026-02-09T18:10:42Z

## Primary Purpose
Cross-platform library discovery utility for Python's ctypes module. Provides the core `find_library(name)` function that locates shared libraries/DLLs on Windows, macOS, AIX, and various Unix-like systems using platform-specific discovery mechanisms.

## Key Functions and Platform Handling

### Windows (os.name == "nt") - L7-68
- **`_get_build_version()` (L9-32)**: Parses MSVC version from `sys.version` to determine Visual C++ runtime version. Returns version number or None for unknown compilers.
- **`find_msvcrt()` (L34-53)**: Returns appropriate MSVC runtime DLL name based on Python build version. Handles debug builds by appending 'd' suffix. Returns None for modern CRT versions (>13) that aren't directly loadable.
- **`find_library(name)` (L55-68)**: Maps 'c'/'m' to MSVC runtime, otherwise searches PATH for library files with/without .dll extension.

### macOS (darwin) - L70-81
- **`find_library(name)` (L72-81)**: Uses ctypes.macholib.dyld for discovery. Searches for `.dylib` files and `.framework` bundles in standard patterns.

### AIX - L83-90
- Imports specialized `find_library` from `ctypes._aix` module to handle AIX's dual library storage (svr4 and archive formats).

### POSIX Systems - L92-333
- **`_is_elf(filename)` (L96-103)**: Validates ELF file format by checking magic header bytes.
- **`_findLib_gcc(name)` (L105-152)**: Uses GCC linker tracing to discover libraries. Creates temporary files and parses linker output with regex. Validates results are actual ELF files.

#### Solaris (sunos5) - L155-269
- **`_get_soname(f)` (L157-172)**: Uses `/usr/ccs/bin/dump` to extract SONAME from shared objects.
- **`_findLib_crle(name, is64)` (L232-266)**: Uses Solaris `crle` command to query runtime linker configuration.
- **`find_library(name, is64=False)` (L268-269)**: Combines crle and gcc discovery methods.

#### BSD Systems (FreeBSD/OpenBSD/DragonFly) - L196-228
- **`_num_version(libname)` (L198-207)**: Parses version numbers from library names for sorting.
- **`find_library(name)` (L209-228)**: Uses `ldconfig -r` output parsing with version-aware selection.

#### Generic POSIX - L271-333
- **`_get_soname(f)` (L174-194)**: Uses `objdump` to extract SONAME from ELF dynamic section.
- **`_findSoname_ldconfig(name)` (L273-301)**: Queries system ldconfig cache with ABI-aware filtering.
- **`_findLib_ld(name)` (L303-328)**: Uses `ld` linker tracing as fallback discovery method.
- **`find_library(name)` (L330-333)**: Cascading strategy: ldconfig → gcc → ld discovery.

## Architecture Patterns
- **Platform Detection**: Uses `os.name` and `sys.platform` for branching logic
- **Tool Availability**: Graceful fallbacks when system tools (gcc, objdump, ldconfig) are unavailable
- **Process Isolation**: Subprocess calls with proper environment setup and error handling
- **Regex-based Parsing**: Extensive use of compiled regex for parsing tool outputs
- **ELF Validation**: Prevents false positives from linker scripts

## Dependencies
- Standard library: `os`, `shutil`, `subprocess`, `sys`, `re`, `tempfile`, `struct`
- Platform-specific: `ctypes.macholib.dyld` (macOS), `ctypes._aix` (AIX), `importlib.machinery` (Windows)

## Test Function
**`test()` (L338-376)**: Comprehensive testing across platforms with library loading examples and platform-specific test cases including AIX 32/64-bit handling.