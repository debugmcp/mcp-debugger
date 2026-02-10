# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/sre_constants.py
@source-hash: 87013dc0b349c2c0
@generated: 2026-02-09T18:09:02Z

## Primary Purpose
Deprecated compatibility module that re-exports regular expression constants from the `re` module. This file serves as a legacy shim for code that previously imported from `sre_constants` directly.

## Key Components
- **Deprecation Warning (L2-4)**: Issues a DeprecationWarning when module is imported, indicating this module is obsolete
- **Dynamic Re-export (L6-7)**: Imports `re._constants` and dynamically copies all non-private attributes to global namespace

## Implementation Details
The module uses `globals().update()` with a dictionary comprehension to selectively copy attributes from `re._constants`, excluding any attributes starting with double underscores (private/magic methods).

## Dependencies
- `warnings`: Standard library for deprecation notice
- `re._constants`: Internal constants module from the `re` package (private implementation detail)

## Architectural Notes
This is a legacy compatibility layer, likely maintained for backward compatibility with older Python code that directly imported regular expression constants from `sre_constants`. The dynamic attribute copying ensures all public constants are available without explicit enumeration.

## Usage Context
Located in LLDB's Python environment for the Rust adapter, suggesting this may be part of a bundled Python distribution or compatibility layer for debugging tools.