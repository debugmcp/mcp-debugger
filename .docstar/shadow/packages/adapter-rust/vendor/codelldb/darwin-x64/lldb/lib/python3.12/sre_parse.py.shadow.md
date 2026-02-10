# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/sre_parse.py
@source-hash: c492913453230608
@generated: 2026-02-09T18:07:57Z

## Purpose
Deprecated compatibility shim for the `sre_parse` module that redirects all functionality to `re._parser`. This file serves as a backward compatibility layer during Python's regex module reorganization.

## Key Components
- **Deprecation Warning (L2-4)**: Issues a `DeprecationWarning` when the module is imported, alerting users that `sre_parse` is deprecated
- **Module Re-export (L6-7)**: Dynamically imports and re-exports all public symbols from `re._parser` module using namespace manipulation

## Architecture Pattern
Implements a **deprecation shim pattern** where:
1. The old module name (`sre_parse`) is retained for backward compatibility
2. All functionality is delegated to the new location (`re._parser`)
3. Users are warned about the deprecation through the warning system
4. Public API surface is preserved by copying non-dunder attributes from the target module

## Critical Details
- Uses `globals().update()` to dynamically populate the module's namespace
- Filters out dunder methods (`k[:2] != '__'`) to avoid overwriting built-in module attributes
- The `stacklevel=2` parameter ensures the warning points to the user's import statement rather than this shim code

## Dependencies
- `warnings` (standard library)
- `re._parser` (internal regex parser module)