# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/sre_constants.py
@source-hash: 87013dc0b349c2c0
@generated: 2026-02-09T18:13:01Z

## Purpose
This file serves as a deprecated compatibility shim for the `sre_constants` module, redirecting imports to the modern `re._constants` module while issuing deprecation warnings.

## Key Components

**Deprecation Warning (L2-4)**: Issues a `DeprecationWarning` when the module is imported, indicating this module is deprecated and should not be used.

**Dynamic Symbol Import (L6-7)**: 
- Imports `re._constants` as the canonical source (L6)
- Uses dynamic attribute copying to expose all non-private symbols from `re._constants` in the current module's namespace (L7)
- Filter condition `k[:2] != '__'` excludes Python magic methods and private attributes

## Architecture Pattern
Implements a **deprecation proxy pattern** - maintains backward compatibility while discouraging usage through warnings. The dynamic `globals().update()` approach ensures all public constants from the target module are available without explicit enumeration.

## Dependencies
- `warnings` (standard library) - for deprecation notifications  
- `re._constants` - the actual implementation being proxied

## Critical Behavior
- All public constants from `re._constants` become available as if defined in this module
- Import triggers deprecation warning but functionality remains intact
- Private/magic attributes (starting with `__`) are deliberately excluded from the proxy