# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/platform.py
@source-hash: 319598df55049db8
@generated: 2026-02-09T18:10:23Z

## Purpose
Cross-platform system identification module that extracts detailed platform, OS, and Python implementation information. Provides unified interfaces to query system properties across Windows, Unix-like systems, macOS, and Java platforms.

## Core Architecture
- **Caching Strategy**: Global caches for expensive operations (`_uname_cache` L887, `_platform_cache` L1217, `_os_release_cache` L1298)
- **Version Parsing**: Sophisticated version comparison system using `_comparable_version()` L141-152 and `_ver_stages` L129-138
- **Platform-Specific Handlers**: Dedicated functions for different OS families with fallback mechanisms

## Key Classes

### uname_result (L843-885)
Custom namedtuple extension providing 6-field uname interface:
- Fields: system, node, release, version, machine, processor
- Lazy processor resolution via `@functools.cached_property` L857-859
- Custom iteration, indexing, and serialization support

### _Processor (L795-835)
Static class for processor identification across platforms:
- Dynamic method dispatch based on `sys.platform` L798
- Platform-specific methods: `get_win32()` L801, `get_OpenVMS()` L809
- Fallback to subprocess `uname -p` L818-834

## Major Functions

### System Information APIs
- `uname()` L890-975: Main system info aggregator with caching and fallback logic
- `system()`, `node()`, `release()`, `version()`, `machine()`, `processor()` L979-1035: Direct accessors
- `platform()` L1219-1291: Human-readable platform string with aliasing support

### Platform-Specific Detection
- `win32_ver()` L446-456: Windows version detection using WMI and registry fallbacks
- `mac_ver()` L481-498: macOS version from SystemVersion.plist
- `java_ver()` L511-542: Jython/Java platform information
- `libc_ver()` L157-235: glibc/libc version detection via binary analysis

### Python Implementation Analysis
- `_sys_version()` L1041-1137: Comprehensive sys.version parsing for CPython/PyPy/Jython
- `python_implementation()`, `python_version()`, etc. L1139-1213: Parsed Python metadata

### Utility Functions
- `architecture()` L691-764: Binary architecture detection using `file` command
- `system_alias()` L546-584: Marketing name normalization (SunOS→Solaris, win32→Windows)
- `freedesktop_os_release()` L1328-1348: Linux distribution info from os-release files

## Dependencies & Relationships
- **Standard Library**: os, sys, re, subprocess, collections, functools, itertools
- **Platform-Specific**: winreg/_winreg (Windows), vms_lib (OpenVMS), java.lang (Jython)
- **Optional**: _wmi (Windows WMI queries), plistlib (macOS)

## Critical Patterns
- **Graceful Degradation**: Multiple fallback mechanisms for each detection method
- **Exception Isolation**: Broad exception handling to prevent cascade failures
- **Binary Analysis**: Direct executable scanning for libc version detection L189-235
- **Environment Variables**: Processor info from Windows PROCESSOR_* vars L790-792

## Data Structures
- Windows version mappings: `_WIN32_CLIENT_RELEASES` L336, `_WIN32_SERVER_RELEASES` L350
- Architecture defaults: `_default_architecture` L685-689
- Version stage weights: `_ver_stages` L129-138 for semantic version comparison

## Command Line Interface
L1353-1357: Supports --terse and --nonaliased flags for platform string output