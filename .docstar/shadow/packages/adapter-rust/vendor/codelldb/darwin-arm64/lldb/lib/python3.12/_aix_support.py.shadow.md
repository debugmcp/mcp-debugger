# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/_aix_support.py
@source-hash: 0982f187c62fbfc1
@generated: 2026-02-09T18:06:57Z

## Purpose
AIX platform support module providing utilities to determine AIX system version, release, technology level, and build compatibility information for Python package management (PEP 425 platform tags).

## Key Functions

**`_read_cmd_output(commandstring, capture_stderr=False)` (L8-23)**
- Executes shell commands and captures output without using `os.popen` (safe during Python bootstrap)
- Creates temporary file `/tmp/_aix_support.{pid}` for output capture
- Returns command output as bytes or `None` if command fails
- Fallback mechanism when subprocess module unavailable

**`_aix_tag(vrtl, bd)` (L26-32)**
- Generates PEP 425 compliant AIX platform tags
- Input: `vrtl` (version/release/tech_level list), `bd` (build date)
- Format: `"aix-{v:1x}{r:1d}{tl:02d}-{bd:04d}-{bitsize}"`
- Infers bitwidth from `sys.maxsize` (32/64-bit detection)

**`_aix_vrtl(vrmf)` (L36-39)**
- Parses VRMF (Version.Release.Modification.Fix) strings
- Extracts version (last digit), release, and technology level
- Returns `[int, int, int]` list for version components

**`_aix_bos_rte()` (L42-60)**
- Queries AIX Base Operating System runtime environment info
- Uses `/usr/bin/lslpp -Lqc bos.rte` command via subprocess or fallback
- Returns tuple of (VRMF_string, build_date_int)
- Defaults build date to 9988 if unavailable

**`aix_platform()` (L63-83)**
- Main public API for current AIX platform identification
- Combines `_aix_bos_rte()` and `_aix_vrtl()` data into platform tag
- Used for runtime platform detection

**`_aix_bgt()` (L87-92)**
- Extracts version info from `BUILD_GNU_TYPE` sysconfig variable
- Used for build-time platform detection
- Raises ValueError if BUILD_GNU_TYPE undefined

**`aix_buildtag()` (L95-108)**
- Returns platform tag for the system where Python was built
- Uses `AIX_BUILDDATE` sysconfig variable
- Validates build date as integer
- Used for cross-compilation scenarios

## Dependencies
- `sys`, `sysconfig` (standard library)
- `subprocess` (with fallback to custom command execution)
- `os`, `contextlib` (for file operations)

## Architecture Notes
- Designed to work during Python bootstrap (minimal dependencies)
- Implements fallback mechanisms when standard modules unavailable
- Follows PEP 425 platform tag specifications for AIX
- Handles both runtime and build-time platform detection