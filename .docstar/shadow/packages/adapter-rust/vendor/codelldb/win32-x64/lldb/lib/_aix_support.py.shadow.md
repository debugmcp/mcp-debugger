# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/_aix_support.py
@source-hash: 0982f187c62fbfc1
@generated: 2026-02-09T18:12:46Z

**Purpose:** AIX platform identification and compatibility support for Python packaging (PEP 425), providing utilities to generate AIX-specific platform tags based on system version, release, technology level, and build dates.

**Key Functions:**

- **`_read_cmd_output(commandstring, capture_stderr=False)` (L8-23):** Executes shell commands during bootstrap when subprocess module unavailable. Creates temporary file in `/tmp`, redirects command output, returns decoded result or None on failure. Used as fallback for `lslpp` command execution.

- **`_aix_tag(vrtl, bd)` (L26-32):** Core tag formatter generating AIX platform strings in format `aix-{version}{release}{tech_level}-{builddate}-{bitsize}`. Infers bitwidth from `sys.maxsize` (32/64-bit), uses fallback builddate 9988 when unavailable.

- **`_aix_vrtl(vrmf)` (L36-39):** Parses VRMF (Version.Release.Modification.Fix) strings into integer list `[version, release, tech_level]`. Takes first 3 dot-separated components, extracts last digit of version.

- **`_aix_bos_rte()` (L42-60):** Retrieves current AIX runtime environment details from `bos.rte` fileset using `/usr/bin/lslpp`. Returns tuple of (VRMF_string, builddate). Handles subprocess unavailability during bootstrap by falling back to `_read_cmd_output`.

- **`aix_platform()` (L63-83):** Primary entry point generating runtime platform tag for current AIX system. Combines `_aix_bos_rte()` output with `_aix_tag()` formatting. Used for determining binary compatibility.

- **`_aix_bgt()` (L87-92):** Extracts version info from `BUILD_GNU_TYPE` sysconfig variable, used for build-time platform identification. Raises `ValueError` if undefined.

- **`aix_buildtag()` (L95-108):** Generates platform tag for the system where Python was built (vs. current runtime). Uses `AIX_BUILDDATE` sysconfig variable and `_aix_bgt()` for version info.

**Dependencies:**
- `sys`, `sysconfig` (standard library)
- `subprocess` (optional, with fallback)
- `os`, `contextlib` (imported locally)

**Architecture:**
- Designed for Python packaging infrastructure (wheel tags, pip)
- Bootstrap-safe: handles environments where subprocess unavailable
- AIX-specific: leverages `lslpp` command and `bos.rte` fileset
- PEP 425 compliance for platform tag generation

**Critical Constraints:**
- Assumes `/usr/bin/lslpp` availability on AIX systems
- Temporary file creation in `/tmp` (potential permission issues)
- Hardcoded fallback values (builddate 9988) when system info unavailable
- Platform tag format must match PEP 425 specifications