# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/sre_compile.py
@source-hash: f7fd87f8ac9dad7d
@generated: 2026-02-09T18:13:00Z

## Primary Purpose
Deprecated compatibility shim module that re-exports the `re._compiler` module interface while issuing deprecation warnings.

## Key Components
- **Deprecation Warning (L2-4)**: Issues `DeprecationWarning` when module is imported, indicating the module is deprecated
- **Dynamic Re-export (L6-7)**: Imports `re._compiler` and dynamically copies all non-dunder attributes to the current module's global namespace

## Dependencies
- `warnings`: Standard library module for issuing deprecation warnings
- `re._compiler`: Internal regex compilation module being re-exported

## Architectural Pattern
This is a typical deprecation shim pattern - maintains backward compatibility by providing the same interface as the target module while warning users about deprecation. The dynamic attribute copying via `globals().update()` ensures all public APIs from `re._compiler` are available through this module.

## Critical Behavior
- Warns on every import (not just first import)
- Only copies attributes that don't start with double underscore (avoiding private/special methods)
- Stacklevel=2 ensures the warning points to the code that imported this module, not this module itself