# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/platform.py
@source-hash: 319598df55049db8
@generated: 2026-02-09T18:09:09Z

## Primary Purpose
Platform identification module that detects OS, architecture, and Python implementation details across multiple platforms. Provides comprehensive APIs for querying system information in a portable way.

## Core Architecture

### Main Entry Points
- `uname()` (L890-975): Primary interface returning tuple of (system, node, release, version, machine, processor)
- `platform()` (L1219-1291): High-level string representation of platform info with optional aliasing
- `architecture()` (L691-764): Detects executable bit-width and linkage format

### Platform-Specific Detection
- **Windows**: `win32_ver()` (L446-456), `_win32_ver()` (L384-444) with WMI queries and registry access
- **macOS**: `mac_ver()` (L481-498), `_mac_ver_xml()` (L459-478) parsing SystemVersion.plist
- **Java/Jython**: `java_ver()` (L511-542) using Java system properties
- **Linux**: `libc_ver()` (L157-235) scanning executables for glibc/libc version info

### Key Classes & Data Structures
- `uname_result` (L843-885): Enhanced namedtuple with lazy processor detection via `_Processor` class
- `_Processor` (L795-835): Platform-specific CPU detection with fallback to `uname -p`
- Version lookup tables: `_WIN32_CLIENT_RELEASES` (L336-348), `_WIN32_SERVER_RELEASES` (L350-361)

### Utility Functions
- `_comparable_version()` (L141-152): Converts version strings to comparable tuples
- `_syscmd_ver()` (L262-314): Windows version detection via 'ver' command
- `_syscmd_file()` (L647-679): Unix 'file' command interface for architecture detection
- `_platform()` (L588-618): Formats platform strings for filenames
- `system_alias()` (L546-584): Maps internal names to marketing names (e.g., SunOS → Solaris)

### Python Implementation Detection
- `_sys_version()` (L1041-1137): Parses `sys.version` with regex for CPython/PyPy/Jython
- Implementation-specific functions: `python_implementation()` (L1139-1149), `python_version()` (L1151-1159)

### OS Release Detection
- `freedesktop_os_release()` (L1328-1348): Parses `/etc/os-release` for Linux distributions
- `_parse_os_release()` (L1301-1325): Shell-style parsing with unescaping

## Critical Dependencies
- `os`, `sys`: Core platform APIs
- `subprocess`: External command execution
- `winreg`/`_winreg`: Windows registry access (optional)
- `_wmi`: Windows Management Instrumentation (optional)
- `plistlib`: macOS plist parsing (optional)
- `vms_lib`: OpenVMS support (optional)

## Caching Strategy
Global caches for expensive operations:
- `_uname_cache` (L887): Main uname result
- `_sys_version_cache` (L1039): Parsed Python version info
- `_platform_cache` (L1217): Platform strings by (aliased, terse) key
- `_os_release_cache` (L1298): Parsed os-release data

## Command Line Interface
Direct execution (L1353-1358) prints platform string with --terse and --nonaliased options.

## Notable Patterns
- Graceful degradation with try/except blocks for optional dependencies
- Platform-specific method dispatch in `_Processor.get()`
- Lazy evaluation in `uname_result.processor` property
- Extensive fallback chains for cross-platform compatibility