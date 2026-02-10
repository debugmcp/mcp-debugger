# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/platform.py
@source-hash: 319598df55049db8
@generated: 2026-02-09T18:07:23Z

## Platform Detection Module

**Purpose**: Cross-platform system information detection library providing unified interfaces to query OS, hardware, and Python implementation details. Part of Python's standard library, this version is bundled with LLDB/CodeLLDB for debugging support.

### Core Architecture

**Version Comparison System (L129-152)**:
- `_ver_stages` (L129-138): Version stage priority mapping (dev=10, alpha=20, etc.)
- `_comparable_version()` (L141-152): Converts version strings to comparable tuples

**Caching Strategy**:
- `_uname_cache` (L887): Global cache for uname results
- `_sys_version_cache` (L1039): Cache for parsed Python version info
- `_platform_cache` (L1217): Cache for platform strings
- `_os_release_cache` (L1298): Cache for freedesktop.org os-release data

### Platform-Specific Detection

**Windows Support (L336-456)**:
- `_WIN32_CLIENT_RELEASES` (L336-348): Version mapping for client Windows
- `_WIN32_SERVER_RELEASES` (L350-361): Version mapping for server Windows  
- `win32_ver()` (L446-456): Main Windows version detection API
- `_win32_ver()` (L384-444): Core Windows detection using WMI then fallback
- `win32_edition()` (L366-382): Windows edition detection via registry
- `win32_is_iot()` (L363-364): IoT Windows variant detection

**macOS Support (L459-498)**:
- `mac_ver()` (L481-498): macOS version detection API
- `_mac_ver_xml()` (L459-478): Reads SystemVersion.plist for version info

**Linux Support**:
- `libc_ver()` (L157-235): Detects libc/glibc version by binary analysis
- `freedesktop_os_release()` (L1328-1348): Parses /etc/os-release standard
- `_parse_os_release()` (L1301-1325): Parser for os-release format

**Java/Jython Support (L500-542)**:
- `java_ver()` (L511-542): Java platform detection
- `_java_getprop()` (L500-509): Java system property accessor

### System Command Interfaces

**Command Execution (L262-314)**:
- `_syscmd_ver()` (L262-314): Executes 'ver' command on DOS/Windows platforms
- `_syscmd_file()` (L647-679): Uses Unix 'file' command for binary analysis

**Architecture Detection (L691-764)**:
- `architecture()` (L691-764): Determines bit-width and binary format
- `_default_architecture` (L685-689): Fallback values for known platforms

### Unified APIs

**Main Platform Interface**:
- `uname()` (L890-975): Central platform detection, returns `uname_result`
- `uname_result` class (L843-885): Enhanced namedtuple with lazy processor field
- Individual accessors: `system()` (L979), `node()` (L988), `release()` (L998), `version()` (L1007), `machine()` (L1016), `processor()` (L1025)

**Python Implementation Detection (L1039-1213)**:
- `_sys_version()` (L1041-1137): Parses sys.version for implementation details
- `python_implementation()` (L1139): Returns CPython/Jython/PyPy
- Version accessors: `python_version()` (L1151), `python_version_tuple()` (L1161), etc.

**Master Platform String**:
- `platform()` (L1219-1291): Generates human-readable platform identification
- `system_alias()` (L546-584): Applies marketing name aliases (SunOS→Solaris)

### Hardware Detection

**Processor Information**:
- `_Processor` class (L795-835): Platform-specific processor detection
- `_get_machine_win32()` (L767-792): Windows machine architecture via WMI/env vars

**WMI Integration (L316-333)**:
- `_wmi_query()`: Windows Management Instrumentation interface for system data

### Utility Functions

**Internal Helpers**:
- `_platform()` (L588-618): Formats platform strings with filename-safe chars  
- `_node()` (L620-633): Network hostname detection
- `_follow_symlinks()` (L635-644): Symlink resolution
- `_norm_version()` (L237-250): Version string normalization
- `_unknown_as_blank()` (L837-838): Filters 'unknown' values

### Command Line Interface (L1353-1358)
Supports `--terse` and `--nonaliased` flags for customized platform output.