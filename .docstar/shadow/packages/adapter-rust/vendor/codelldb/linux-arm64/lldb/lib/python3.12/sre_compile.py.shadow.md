# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/sre_compile.py
@source-hash: f7fd87f8ac9dad7d
@generated: 2026-02-09T18:09:01Z

## Primary Purpose
Backward compatibility shim for deprecated `sre_compile` module. This file provides a deprecation warning and forwards all non-private attributes from the current `re._compiler` module to maintain compatibility with legacy code.

## Key Components
- **Deprecation Warning (L2-4)**: Issues a `DeprecationWarning` when the module is imported, alerting users that this module is deprecated
- **Module Forwarding (L6-7)**: Dynamically imports and re-exports all public attributes from `re._compiler` using namespace injection via `globals().update()`

## Dependencies
- `warnings`: Standard library module for issuing deprecation warnings
- `re._compiler`: The actual implementation module that this deprecated module forwards to

## Architectural Pattern
This is a classic deprecation wrapper pattern that:
1. Maintains backward compatibility for existing code importing `sre_compile`
2. Provides migration guidance through deprecation warnings
3. Transparently forwards all functionality to the new location (`re._compiler`)

## Critical Behavior
- All public functions, classes, and constants from `re._compiler` become available in this module's namespace
- The warning is issued at `stacklevel=2` to point to the caller's location rather than this wrapper
- Only non-dunder attributes (those not starting with `__`) are forwarded to avoid namespace pollution