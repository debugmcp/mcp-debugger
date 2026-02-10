# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/datetime.py
@source-hash: ef20dc6b3554cd58
@generated: 2026-02-09T18:14:13Z

**Purpose**: Compatibility shim module that provides a unified datetime API by attempting to import from either the C implementation (`_datetime`) or pure Python fallback (`_pydatetime`).

**Key Components**:
- Import strategy (L1-6): Try C implementation first, fallback to Python implementation on ImportError
- Public API exports (L8-9): Explicitly defines `__all__` with core datetime types and constants

**Dependencies**:
- `_datetime`: C-based datetime implementation (preferred)
- `_pydatetime`: Pure Python datetime implementation (fallback)

**Architecture Pattern**: 
This follows Python's common pattern of providing optimized C implementations with pure Python fallbacks for portability. The module acts as a transparent facade, exposing identical APIs regardless of which underlying implementation is available.

**Exported Interface**:
- Core types: `date`, `datetime`, `time`, `timedelta`, `timezone`, `tzinfo`
- Constants: `MINYEAR`, `MAXYEAR`, `UTC`
- Documentation from underlying module via `__doc__`

**Critical Behavior**: The actual functionality depends entirely on which underlying module successfully imports. This module provides no logic of its own beyond the import selection mechanism.