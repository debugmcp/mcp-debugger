# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/zoneinfo/_tzpath.py
@source-hash: 5dc473af6f6ae35e
@generated: 2026-02-09T18:11:25Z

## Primary Purpose
Timezone path management module for Python's zoneinfo package. Manages global TZPATH configuration for locating timezone data files, validates timezone keys, and discovers available timezones.

## Key Components

### Core Path Management Functions
- `_reset_tzpath(to=None, stacklevel=4)` (L5-25): Internal function that sets global TZPATH from explicit paths, PYTHONTZPATH environment variable, or sysconfig TZPATH. Validates paths are absolute.
- `reset_tzpath(to=None)` (L28-33): Public API wrapper for _reset_tzpath with normalized stack level for warnings.
- `_parse_python_tzpath(env_var, stacklevel)` (L36-56): Parses colon-separated timezone paths from environment variables, filters out relative paths, and warns about invalid entries using InvalidTZPathWarning.

### Path Validation
- `_validate_tzfile_path(path, _base=_TEST_PATH)` (L85-105): Security validation ensuring timezone keys are normalized relative paths that don't escape TZPATH directories. Prevents directory traversal attacks.
- `_get_invalid_paths_message(tzpaths)` (L59-68): Formats error messages for invalid relative paths with indented display.

### Timezone Discovery
- `find_tzfile(key)` (L71-79): Locates TZif files by searching TZPATH directories for the given timezone key.
- `available_timezones()` (L111-173): Discovers all available timezone names by checking tzdata package zones file first, then walking TZPATH directories and validating TZif magic bytes. Excludes special "right", "posix", and "posixrules" entries.

### Global State
- `TZPATH` (L180): Tuple of absolute paths where timezone files are searched, initialized at module load.
- `InvalidTZPathWarning` (L176-177): RuntimeWarning subclass for invalid path notifications.
- `_TEST_PATH` (L82): Normalization helper for path validation, deleted after use (L108).

## Architecture
Module uses lazy initialization pattern - TZPATH is set at import time via _reset_tzpath(). Environment variable precedence: PYTHONTZPATH → sysconfig.TZPATH. Security-first design with multiple validation layers preventing path traversal and ensuring absolute paths only.