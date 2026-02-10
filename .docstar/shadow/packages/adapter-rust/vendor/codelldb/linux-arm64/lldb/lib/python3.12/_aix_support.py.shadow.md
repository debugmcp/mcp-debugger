# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/_aix_support.py
@source-hash: 0982f187c62fbfc1
@generated: 2026-02-09T18:09:17Z

## Purpose
AIX platform support module providing utility functions to determine AIX system information, build tags, and platform compatibility for Python packaging (PEP 425). Part of Python's packaging infrastructure for AIX systems.

## Key Functions

**_read_cmd_output(L8-23)**: Command execution utility that creates temporary file to capture command output, used as fallback when subprocess is unavailable during Python bootstrap. Uses `/tmp/_aix_support.<pid>` temporary files.

**_aix_tag(L26-32)**: Core tag formatting function that generates PEP 425 compatible AIX platform tags. Takes version/release/technology_level list and build date, infers bitwidth from `sys.maxsize`, returns format: `"aix-{v:1x}{r:1d}{tl:02d}-{bd:04d}-{bitsize}"`.

**_aix_vrtl(L36-39)**: VRMF string parser that extracts version, release, and technology level from dot-separated version strings. Returns list of integers `[version[-1], release, tech_level]`.

**_aix_bos_rte(L42-60)**: System introspection function that queries AIX runtime level using `/usr/bin/lslpp -Lqc bos.rte` command. Returns tuple of (VRMF_string, build_date). Uses subprocess when available, falls back to `_read_cmd_output`.

**aix_platform(L63-83)**: Main platform detection function that determines current AIX platform tag by combining BOS runtime info. Returns current system's PEP 425 platform tag.

**_aix_bgt(L87-92)**: Build GNU type parser that extracts version info from `sysconfig.BUILD_GNU_TYPE` variable.

**aix_buildtag(L95-108)**: Build-time platform tag generator that returns the platform tag of the system where Python was built, using `sysconfig.AIX_BUILDDATE`.

## Dependencies
- `sys`: For maxsize bitwidth detection
- `sysconfig`: For build configuration variables
- `os`: For process ID and system calls
- `contextlib`: For file handle management
- `subprocess`: Optional, for command execution

## Architecture Notes
- Implements fallback strategy for command execution during Python bootstrap
- Uses temporary files for cross-process communication
- Provides both runtime and build-time platform detection
- Follows PEP 425 platform tag specification for AIX systems

## Critical Constraints
- Requires `/usr/bin/lslpp` to be available on AIX systems
- BUILD_GNU_TYPE and AIX_BUILDDATE must be defined in sysconfig for build tag generation
- Default build date 9988 used when actual build date unavailable