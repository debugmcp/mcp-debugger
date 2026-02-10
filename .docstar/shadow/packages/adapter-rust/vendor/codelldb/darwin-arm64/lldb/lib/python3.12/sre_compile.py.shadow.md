# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/sre_compile.py
@source-hash: f7fd87f8ac9dad7d
@generated: 2026-02-09T18:07:12Z

**Purpose**: Legacy compatibility shim for the deprecated `sre_compile` module, redirecting to `re._compiler`.

**Core Functionality**:
- **Deprecation Warning (L2-4)**: Issues a `DeprecationWarning` when module is imported, indicating this module is deprecated
- **Module Proxy (L6-7)**: Dynamically imports all public symbols from `re._compiler` into current namespace, effectively making this module a transparent alias

**Key Implementation Details**:
- Uses `globals().update()` with dictionary comprehension to copy all non-dunder attributes from `re._compiler`
- Filter condition `k[:2] != '__'` excludes private/magic methods from being copied
- `stacklevel=2` in warning ensures the warning points to the caller's code, not this shim

**Dependencies**:
- `warnings` module for deprecation notification
- `re._compiler` as the actual implementation being proxied

**Architectural Pattern**: 
This is a deprecation shim pattern - maintaining backward compatibility while guiding users toward the new API. The module serves as a transparent proxy that warns about deprecation but maintains full functional compatibility.