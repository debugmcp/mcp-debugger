# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/datetime.py
@source-hash: ef20dc6b3554cd58
@generated: 2026-02-09T18:08:31Z

## Primary Purpose
This file serves as the public interface for Python's datetime module, implementing a fallback mechanism between C and Python implementations.

## Key Components

**Import Strategy (L1-6)**: Implements a two-tier import strategy:
- First attempts to import from `_datetime` (C extension implementation for performance)
- Falls back to `_pydatetime` (pure Python implementation) if C extension unavailable
- Imports both module contents and `__doc__` from the selected implementation

**Public API Declaration (L8-9)**: Defines `__all__` tuple specifying the module's public interface:
- Core classes: `date`, `datetime`, `time`, `timedelta`, `timezone`, `tzinfo`
- Constants: `MINYEAR`, `MAXYEAR`, `UTC`

## Architectural Pattern
This is a standard Python pattern for providing performance-optimized C extensions with pure Python fallbacks. The file acts as a transparent proxy that exposes the same interface regardless of which underlying implementation is used.

## Dependencies
- `_datetime`: C extension module (preferred)
- `_pydatetime`: Pure Python implementation (fallback)

## Critical Behavior
All actual datetime functionality is delegated to the imported implementation. This file contains no business logic, only import orchestration.