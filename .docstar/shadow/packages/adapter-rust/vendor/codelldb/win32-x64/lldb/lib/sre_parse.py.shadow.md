# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/sre_parse.py
@source-hash: c492913453230608
@generated: 2026-02-09T18:13:01Z

## Purpose and Responsibility
This file serves as a deprecated compatibility shim for the `sre_parse` module, redirecting all functionality to the modern `re._parser` module while warning users about the deprecation.

## Key Components
- **Deprecation Warning (L2-4)**: Issues a `DeprecationWarning` when the module is imported, informing users that `sre_parse` is deprecated
- **Module Proxy Pattern (L6-7)**: Dynamically imports all public symbols from `re._parser` and injects them into the current module's namespace

## Dependencies
- `warnings`: Standard library module for issuing deprecation warnings
- `re._parser`: The modern replacement module that contains the actual implementation

## Architectural Pattern
Implements a **deprecation wrapper pattern** where:
1. The old module name (`sre_parse`) is preserved for backward compatibility
2. All functionality is transparently delegated to the new location (`re._parser`)
3. Users are warned about the deprecation but code continues to work
4. Private attributes (those starting with `__`) are excluded from the proxy to avoid namespace pollution

## Critical Behavior
- **Transparent Proxy**: All public attributes and functions from `re._parser` become available as if they were defined in this module
- **Warning on Import**: Every import of this module triggers a deprecation warning with `stacklevel=2` to point to the caller's location
- **Backward Compatibility**: Existing code using `sre_parse` continues to function without modification