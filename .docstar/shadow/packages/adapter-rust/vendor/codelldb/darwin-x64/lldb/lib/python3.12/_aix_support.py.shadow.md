# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/_aix_support.py
@source-hash: 0982f187c62fbfc1
@generated: 2026-02-09T18:07:29Z

## Purpose
AIX platform support module providing utilities to determine AIX system version, build information, and generate platform tags for Python package compatibility (PEP 425).

## Key Functions

**`_read_cmd_output(commandstring, capture_stderr=False)` (L8-23)**
- Executes shell commands and captures output without using os.popen
- Creates temporary file `/tmp/_aix_support.{pid}` for output capture
- Used during Python bootstrap when subprocess may not be available
- Returns command output as bytes or None on failure

**`_aix_tag(vrtl, bd)` (L26-32)**
- Generates AIX platform tag string in format: `aix-{version}{release}{tech_level}-{builddate}-{bitsize}`
- Infers ABI bitwidth from sys.maxsize (32/64 bit)
- Uses default builddate 9988 if bd is 0

**`_aix_vrtl(vrmf)` (L36-39)**
- Parses VRMF (Version.Release.Modification.Fix) string
- Returns list of [version_last_digit, release, tech_level] as integers

**`_aix_bos_rte()` (L42-60)**
- Queries AIX runtime level using `/usr/bin/lslpp -Lqc bos.rte`
- Prefers subprocess when available, falls back to `_read_cmd_output`
- Returns tuple of (VRMF_string, builddate_int)
- Uses fallback builddate 9988 for compatibility

**`aix_platform()` (L63-83)**
- Main entry point for current AIX platform identification
- Combines VRMF parsing and builddate to generate platform tag
- Used for runtime platform detection

**`_aix_bgt()` (L87-92)**
- Extracts version info from sysconfig BUILD_GNU_TYPE
- Raises ValueError if BUILD_GNU_TYPE undefined

**`aix_buildtag()` (L95-108)**
- Returns platform tag for the system where Python was built
- Uses sysconfig AIX_BUILDDATE variable
- Raises ValueError for invalid/missing build date

## Dependencies
- sys, sysconfig (stdlib)
- subprocess (when available)
- os, contextlib (imported locally)

## Architecture Notes
- Designed to work during Python bootstrap (limited stdlib availability)
- AIX ABI compatibility based on IBM documentation
- Platform tags follow PEP 425 naming conventions
- Handles both 32-bit and 64-bit AIX systems