# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/sre_compile.py
@source-hash: f7fd87f8ac9dad7d
@generated: 2026-02-09T18:07:55Z

## Purpose
Legacy compatibility shim for the deprecated `sre_compile` module. This file provides backward compatibility by re-exporting all public symbols from the modern `re._compiler` module while issuing deprecation warnings.

## Key Components

**Deprecation Warning (L2-4)**: Issues a `DeprecationWarning` when the module is imported, alerting users that `sre_compile` is deprecated and should be replaced with `re._compiler`.

**Symbol Re-export (L6-7)**: Dynamically imports all non-dunder attributes from `re._compiler` and injects them into the current module's global namespace, maintaining API compatibility for legacy code.

## Dependencies
- `warnings` (L1): Standard library module for issuing deprecation warnings
- `re._compiler` (L6): The actual implementation module that replaced `sre_compile`

## Architectural Pattern
This is a classic deprecation shim pattern that:
1. Warns about deprecated usage
2. Delegates functionality to the replacement module
3. Maintains backward compatibility during transition periods

## Critical Notes
- All functionality is delegated to `re._compiler`
- Only public symbols (not starting with `__`) are re-exported
- This module exists solely for backward compatibility and should not be used in new code