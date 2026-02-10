# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/sre_parse.py
@source-hash: c492913453230608
@generated: 2026-02-09T18:09:01Z

## Primary Purpose
Legacy compatibility shim for the deprecated `sre_parse` module. This file serves as a thin wrapper that redirects to the modern `re._parser` implementation while issuing deprecation warnings.

## Key Components
- **Deprecation Warning (L2-4)**: Issues a `DeprecationWarning` when the module is imported, indicating this module is deprecated
- **Module Re-export (L6-7)**: Dynamically imports all public symbols from `re._parser` and injects them into the current module's namespace

## Architecture Pattern
Uses a namespace forwarding pattern - imports the replacement module (`re._parser`) and copies all non-private attributes (those not starting with `__`) into the current module's global namespace. This maintains backward compatibility while signaling deprecation.

## Dependencies
- `warnings` (stdlib): For deprecation notification
- `re._parser`: The actual implementation module being forwarded to

## Critical Behavior
The module acts as a transparent proxy - any code importing `sre_parse` will get the same symbols as importing `re._parser`, but with a deprecation warning. This allows legacy code to continue functioning while encouraging migration to the newer module structure.