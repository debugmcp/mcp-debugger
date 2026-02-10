# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/sre_constants.py
@source-hash: 87013dc0b349c2c0
@generated: 2026-02-09T18:09:52Z

**Primary Purpose**
Legacy compatibility shim that re-exports constants from `re._constants` while warning about deprecation. Part of Python's standard library transition from the old `sre_constants` module to the newer `re._constants` module.

**Key Components**
- **Deprecation Warning (L2-4)**: Issues a DeprecationWarning when module is imported, indicating this module should no longer be used
- **Re-export Mechanism (L6-7)**: Dynamically imports all public constants from `re._constants` and makes them available in this module's namespace

**Dependencies**
- `warnings`: Standard library module for issuing deprecation warning
- `re._constants`: Internal module containing actual regex constants implementation

**Architectural Pattern**
Uses dynamic namespace population via `globals().update()` to transparently proxy all non-private attributes from the new module, maintaining backward compatibility while encouraging migration.

**Critical Behavior**
- All public constants from `re._constants` become available as if defined in this module
- Private attributes (starting with `__`) are filtered out during re-export
- Warning is issued on every import, not just first use