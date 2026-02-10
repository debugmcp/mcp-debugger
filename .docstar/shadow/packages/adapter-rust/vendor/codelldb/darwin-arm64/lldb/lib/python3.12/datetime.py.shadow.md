# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/datetime.py
@source-hash: ef20dc6b3554cd58
@generated: 2026-02-09T18:06:58Z

## Purpose
This is a Python datetime module bootstrap file that serves as a compatibility layer, attempting to import from the C-based `_datetime` module first, falling back to the pure Python `_pydatetime` implementation if unavailable.

## Key Components

### Import Strategy (L1-6)
- **Primary import (L2-3)**: Attempts to import all symbols and documentation from `_datetime` (C extension)
- **Fallback import (L5-6)**: Falls back to `_pydatetime` (pure Python implementation) on ImportError
- This pattern provides performance optimization while maintaining compatibility

### Public API Export (L8-9)
- **`__all__` declaration**: Explicitly defines the public interface with 9 core datetime symbols
- Includes fundamental types: `date`, `datetime`, `time`, `timedelta`, `timezone`, `tzinfo`
- Includes constants: `MINYEAR`, `MAXYEAR`, `UTC`

## Architectural Decisions
- **Performance-first approach**: Prioritizes C extension for speed
- **Graceful degradation**: Ensures functionality even without C extensions
- **Consistent API**: Both implementations provide identical public interfaces
- **Documentation forwarding**: Preserves original module documentation regardless of implementation

## Dependencies
- `_datetime` (optional C extension)
- `_pydatetime` (pure Python fallback)

This file acts as a transparent proxy, allowing users to import `datetime` without concern for the underlying implementation details.