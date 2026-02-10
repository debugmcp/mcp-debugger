# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/datetime.py
@source-hash: ef20dc6b3554cd58
@generated: 2026-02-09T18:07:33Z

## Purpose and Responsibility
Compatibility shim that provides access to Python's datetime functionality. Acts as a fallback mechanism to ensure datetime classes are available regardless of whether the C extension (`_datetime`) or pure Python implementation (`_pydatetime`) is used.

## Key Structure
**Import Logic (L1-6)**: Try-except block that attempts to import from the C-based `_datetime` module first, falling back to the pure Python `_pydatetime` implementation if the C extension is unavailable. Also imports the `__doc__` attribute from whichever module is successfully loaded.

**Public API (L8-9)**: Explicitly defines `__all__` tuple containing the standard datetime module exports: `date`, `datetime`, `time`, `timedelta`, `timezone`, `tzinfo`, `MINYEAR`, `MAXYEAR`, and `UTC`.

## Dependencies
- `_datetime`: C extension module (preferred)
- `_pydatetime`: Pure Python fallback implementation

## Architectural Decisions
- **Performance-First Strategy**: Prioritizes the faster C implementation over pure Python
- **Graceful Degradation**: Ensures functionality remains available even without C extensions
- **Transparent Interface**: Provides identical API regardless of underlying implementation
- **Documentation Preservation**: Maintains original docstring from the loaded module

## Critical Constraints
- Assumes both `_datetime` and `_pydatetime` provide identical APIs
- Relies on ImportError to detect missing C extensions
- All exported symbols must be available in both implementations