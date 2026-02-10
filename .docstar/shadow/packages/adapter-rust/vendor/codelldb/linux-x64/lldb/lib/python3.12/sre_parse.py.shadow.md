# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/sre_parse.py
@source-hash: c492913453230608
@generated: 2026-02-09T18:09:53Z

## Primary Purpose
This file serves as a deprecated compatibility shim for the `sre_parse` module, redirecting all functionality to the modern `re._parser` module while issuing deprecation warnings.

## Key Components

**Deprecation Warning (L2-4)**: Issues a `DeprecationWarning` to alert users that this module is deprecated and should not be used in new code.

**Module Redirection (L6-7)**: 
- Imports `re._parser` as the replacement module
- Dynamically copies all public attributes (non-dunder names) from `re._parser` into the current module's namespace using `globals().update()`

## Architecture Pattern
Implements a **facade/proxy pattern** for backward compatibility - the entire module acts as a transparent wrapper around `re._parser`, maintaining the same API while signaling deprecation.

## Dependencies
- `warnings` (standard library)
- `re._parser` (internal regex parser module)

## Critical Behavior
All function calls, class instantiations, and attribute accesses on this module will be transparently forwarded to the corresponding elements in `re._parser`. This maintains full API compatibility while encouraging migration to the new module structure.