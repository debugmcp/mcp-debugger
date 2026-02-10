# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/platform.py
@source-hash: 319598df55049db8
@generated: 2026-02-09T18:07:59Z

## Purpose
Cross-platform system information retrieval module providing standardized APIs to identify OS, hardware architecture, Python implementation details, and platform-specific version information.

## Core Architecture
**Version Comparison System (L129-152)**: `_comparable_version()` converts version strings to comparable tuples using stage mapping (`_ver_stages`) for alpha/beta/RC ordering.

**Platform Detection Classes**:
- `uname_result` (L843-885): Named tuple extension with lazy processor detection via `@functools.cached_property` 
- `_Processor` (L795-835): Platform-specific CPU detection using class methods for win32, OpenVMS, and subprocess fallbacks

## Key Detection Functions

**libc_ver() (L157-235)**: Analyzes executable binaries to detect glibc/libc versions by scanning for `__libc_init`, `GLIBC_*` symbols using regex patterns. Uses chunked file reading (16KB default) and handles symlinks via `_follow_symlinks()`.

**win32_ver() (L446-456)**: Windows version detection prioritizing WMI queries, falling back to `sys.getwindowsversion()` and registry lookups. Uses predefined release mappings (`_WIN32_CLIENT_RELEASES`, `_WIN32_SERVER_RELEASES`).

**mac_ver() (L481-498)**: macOS version from `/System/Library/CoreServices/SystemVersion.plist` using plistlib.

**architecture() (L691-764)**: Determines bit-width and linkage format using system `file` command, with fallbacks to `struct.calcsize('P')` and platform defaults.

## System Identification APIs

**uname() (L890-975)**: Main platform detection function with global caching (`_uname_cache`). Combines `os.uname()`, platform-specific detection, and normalization. Returns 6-tuple including processor info.

**platform() (L1219-1291)**: Master platform string generator with caching by (aliased, terse) parameters. Applies cosmetic transforms for Darwin→macOS, includes libc info for Linux.

**Direct accessors**: `system()`, `node()`, `release()`, `version()`, `machine()`, `processor()` (L979-1035) - convenience wrappers around `uname()` fields.

## Python Implementation Detection

**_sys_version() (L1041-1137)**: Parses `sys.version` using regex to extract implementation (CPython/Jython/PyPy), version, build info. Handles VCS metadata from `sys._git`/`sys._mercurial`. Results cached in `_sys_version_cache`.

**Python info APIs**: `python_implementation()`, `python_version()`, `python_version_tuple()`, `python_branch()`, `python_revision()`, `python_build()`, `python_compiler()` (L1139-1213).

## OS-Release Support

**freedesktop_os_release() (L1328-1348)**: Linux distribution identification via `/etc/os-release` parsing with shell-style unescaping. Cached globally in `_os_release_cache`.

## Internal Utilities

**_platform() (L588-618)**: Filename-safe platform string formatter removing problematic characters and normalizing separators.

**_syscmd_ver() (L262-314)**: Windows version via VER command with subprocess execution.

**_node() (L620-633)**: Network hostname via `socket.gethostname()`.

**System aliasing**: `system_alias()` (L546-584) maps internal names to marketing names (SunOS→Solaris).

## Dependencies
- Standard library: `os`, `sys`, `re`, `subprocess`, `collections`, `functools`, `itertools`
- Platform-specific: `_wmi` (Windows), `winreg`/`_winreg` (Windows registry), `vms_lib` (OpenVMS), `java.lang` (Jython), `plistlib` (macOS)

## Command Line Interface
When executed directly (L1353-1358), prints platform string with `--terse` and `--nonaliased` options.