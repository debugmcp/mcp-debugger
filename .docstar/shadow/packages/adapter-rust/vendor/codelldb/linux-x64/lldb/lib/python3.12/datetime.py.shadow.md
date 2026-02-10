# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/datetime.py
@source-hash: ef20dc6b3554cd58
@generated: 2026-02-09T18:09:32Z

## Primary Purpose
Standard Python datetime module shim that provides a fallback mechanism for importing datetime functionality. Located in the LLDB debugger's Python environment, this module ensures datetime classes are available regardless of whether the C extension (_datetime) is present.

## Import Strategy (L1-6)
- **Primary import attempt (L2-3)**: Tries to import from `_datetime` (C extension) for performance
- **Fallback import (L5-6)**: Falls back to `_pydatetime` (pure Python implementation) if C extension unavailable
- Both imports use wildcard (`*`) to expose all datetime classes and constants
- Documentation (`__doc__`) is explicitly imported from whichever module succeeds

## Public API (L8-9)
Explicitly defines `__all__` tuple containing the standard datetime module interface:
- Core classes: `date`, `datetime`, `time`, `timedelta`, `timezone`, `tzinfo`
- Constants: `MINYEAR`, `MAXYEAR`, `UTC`

## Architectural Pattern
Implements the standard Python library pattern of C extension with pure Python fallback, ensuring compatibility across different Python installations and environments where C extensions may not be available.

## Dependencies
- `_datetime`: C extension module (preferred)
- `_pydatetime`: Pure Python implementation (fallback)

## Context
Part of LLDB debugger's embedded Python environment, ensuring datetime functionality is available for debugging scripts and extensions regardless of the host system's Python configuration.