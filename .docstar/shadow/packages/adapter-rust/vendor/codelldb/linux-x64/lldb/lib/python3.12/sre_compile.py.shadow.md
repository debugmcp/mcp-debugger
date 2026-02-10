# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/sre_compile.py
@source-hash: f7fd87f8ac9dad7d
@generated: 2026-02-09T18:09:51Z

## Purpose
Deprecated compatibility shim for Python's `sre_compile` module that redirects to the modern `re._compiler` implementation.

## Key Components
- **Deprecation warning (L2-4)**: Issues `DeprecationWarning` when module is imported, informing users of deprecation
- **Module forwarding (L6-7)**: Dynamically imports all public symbols from `re._compiler` and injects them into current module's namespace

## Architecture
This file implements a common Python deprecation pattern:
1. Warn users about deprecated usage
2. Maintain backward compatibility by forwarding to new implementation
3. Filter out private/dunder attributes during symbol forwarding

## Dependencies
- `warnings` - Standard library for deprecation notifications
- `re._compiler` - Internal regex compiler module (the actual implementation)

## Critical Behavior
- All functionality is delegated to `re._compiler`
- Only public symbols (not starting with `__`) are exposed
- Warning is issued at stacklevel=2 to point to caller's location, not this shim