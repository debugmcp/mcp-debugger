# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/decimal.py
@source-hash: c3e37c55ef72b3dd
@generated: 2026-02-09T18:14:14Z

## Primary Purpose
Python decimal arithmetic module providing decimal floating-point arithmetic implementation. Acts as a compatibility shim that imports from either the C extension `_decimal` or pure Python fallback `_pydecimal`.

## Key Components

### Import Logic (L101-108)
- **Preferred Import**: Attempts to import from `_decimal` (C extension) for performance
- **Fallback Import**: Falls back to `_pydecimal` (pure Python implementation) if C extension unavailable
- **Version Imports**: Imports `__version__` and `__libmpdec_version__` from whichever backend is used

### Module Documentation (L1-99)
Comprehensive docstring explaining:
- Decimal arithmetic specification compliance (IEEE 854-1987)
- Use cases: financial applications, precise decimal arithmetic
- Extensive usage examples demonstrating Decimal operations, contexts, precision control, and exception handling

## Architecture Pattern
**Backend Abstraction**: Uses try/except import pattern to transparently switch between optimized C implementation and Python fallback, ensuring compatibility across different Python installations.

## Dependencies
- `_decimal` (preferred C extension)
- `_pydecimal` (Python fallback implementation)

## Critical Behavior
The module provides a unified interface regardless of which backend is loaded. All decimal functionality (Decimal class, Context, arithmetic operations, exception handling) is imported wholesale via `*` imports, making this a transparent proxy module.