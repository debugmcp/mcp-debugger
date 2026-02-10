# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/sre_constants.py
@source-hash: 87013dc0b349c2c0
@generated: 2026-02-09T18:07:13Z

## Purpose
Legacy compatibility module that re-exports regular expression constants from the modern `re._constants` module while issuing a deprecation warning.

## Key Components
- **Deprecation Warning (L2-4)**: Issues `DeprecationWarning` when module is imported, indicating this module is deprecated
- **Dynamic Re-export (L6-7)**: Imports `re._constants` and dynamically copies all non-private attributes (excluding those starting with `__`) into current module's global namespace

## Architecture
This is a thin compatibility shim that maintains backward compatibility for code that previously imported from `sre_constants`. The module follows the common Python pattern of warning about deprecation while still providing the expected functionality.

## Dependencies
- `warnings`: Standard library for issuing deprecation warnings
- `re._constants`: Internal module containing actual regular expression constants

## Critical Behavior
- All public constants from `re._constants` become available as if defined locally
- Import triggers deprecation warning on every use
- No actual constant definitions exist in this file - everything is dynamically imported