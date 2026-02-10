# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/platform.py
@source-hash: 319598df55049db8
@generated: 2026-02-09T18:13:39Z

## Purpose
Platform detection and system information module that provides comprehensive APIs for identifying the underlying operating system, hardware architecture, Python implementation, and various system characteristics. Serves as a cross-platform abstraction layer for system identification.

## Core Architecture
The module employs a multi-layered detection strategy:
- Primary: Native OS APIs and system calls
- Fallback: Shell command execution (`ver`, `uname`, `file`)
- Caching: Results cached globally to avoid repeated expensive operations

## Key Components

### Version Comparison Utilities
- `_comparable_version(version)` (L141-152): Converts version strings to comparable tuples using stage weights
- `_ver_stages` dict (L129-138): Maps version stage names to numeric priorities
- `_norm_version(version, build)` (L237-250): Normalizes version strings to major.minor.build format

### Platform-Specific Detection

#### Linux/libc Detection
- `libc_ver(executable, lib, version, chunksize)` (L157-235): Scans executable binaries for libc/glibc symbols using regex patterns
- Supports both `os.confstr('CS_GNU_LIBC_VERSION')` and binary scanning fallback

#### Windows Detection
- `win32_ver(release, version, csd, ptype)` (L446-456): Returns Windows version information
- `_win32_ver(version, csd, ptype)` (L384-444): Core Windows detection using WMI queries and registry
- `win32_is_iot()` (L363-364): Detects IoT/embedded Windows editions
- `win32_edition()` (L366-382): Reads Windows edition from registry
- `_syscmd_ver(system, release, version, supported_platforms)` (L262-314): Uses `ver` command as fallback
- Windows version lookup tables: `_WIN32_CLIENT_RELEASES` (L336-348), `_WIN32_SERVER_RELEASES` (L350-361)

#### macOS Detection
- `mac_ver(release, versioninfo, machine)` (L481-498): Returns macOS version info
- `_mac_ver_xml()` (L459-478): Parses `/System/Library/CoreServices/SystemVersion.plist`

#### Java Platform Detection
- `java_ver(release, vendor, vminfo, osinfo)` (L511-542): Jython platform information
- `_java_getprop(name, default)` (L500-509): Helper for Java system properties

### Architecture Detection
- `architecture(executable, bits, linkage)` (L691-764): Determines bit architecture and linkage format
- `_syscmd_file(target, default)` (L647-679): Uses system `file` command for executable analysis
- `_default_architecture` dict (L685-689): Platform-specific defaults

### Machine/Processor Detection
- `_get_machine_win32()` (L767-792): Windows processor architecture via WMI and environment
- `_Processor` class (L795-835): Cross-platform processor detection with platform-specific methods

### Core uname Interface
- `uname_result` class (L843-885): Named tuple extending collections.namedtuple with lazy processor resolution
- `uname()` (L890-975): Main platform detection function, cached globally in `_uname_cache`
- Direct accessors: `system()`, `node()`, `release()`, `version()`, `machine()`, `processor()` (L979-1035)

### Python Implementation Detection
- `_sys_version(sys_version)` (L1041-1137): Parses Python's sys.version string with implementation-specific regex patterns
- Python info accessors: `python_implementation()`, `python_version()`, `python_version_tuple()`, `python_branch()`, `python_revision()`, `python_build()`, `python_compiler()` (L1139-1213)

### High-Level Platform String
- `platform(aliased, terse)` (L1219-1291): Generates human-readable platform identification string
- `system_alias(system, release, version)` (L546-584): Maps technical names to marketing names
- `_platform(*args)` (L588-618): Formats platform components into filename-safe string

### OS Release Standard Support
- `freedesktop_os_release()` (L1328-1348): Parses freedesktop.org os-release files
- `_parse_os_release(lines)` (L1301-1325): Parses os-release format with shell-style escaping

## Critical Dependencies
- `collections`, `os`, `re`, `sys`, `functools`, `itertools` (L116-121)
- Platform-specific: `_wmi`, `winreg`/`_winreg`, `java.lang`, `vms_lib`, `plistlib`
- External commands: `ver`, `uname`, `file`

## Important Invariants
- All functions return empty strings for undetermined values
- Results are extensively cached to avoid repeated expensive operations
- Graceful degradation when platform-specific modules/commands unavailable
- Version strings normalized to consistent formats

## Key Patterns
- Try-except chains for graceful fallback across detection methods
- Global caching for expensive operations (`_uname_cache`, `_platform_cache`, `_sys_version_cache`)
- Platform-specific method dispatch pattern in `_Processor` class
- Regex-based parsing for system command outputs and version strings