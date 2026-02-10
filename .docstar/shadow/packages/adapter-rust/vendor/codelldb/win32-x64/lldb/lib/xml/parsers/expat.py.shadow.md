# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/xml/parsers/expat.py
@source-hash: 64e1947747c28741
@generated: 2026-02-09T18:06:04Z

## Purpose
Compatibility layer that exposes the `pyexpat` XML parser as `xml.parsers.expat` module. Acts as a thin wrapper to provide the standard Python XML parsing interface.

## Key Components
- **Module re-export (L4)**: Imports and exposes all `pyexpat` functionality via wildcard import
- **Submodule registration (L7-8)**: Manually registers `pyexpat.model` and `pyexpat.errors` as submodules of `xml.parsers.expat` in the module system

## Dependencies
- `sys`: For module system manipulation
- `pyexpat`: Core Expat XML parser implementation (wildcard imported)

## Architectural Pattern
Standard Python module aliasing pattern - provides a canonical interface (`xml.parsers.expat`) that delegates to the actual implementation (`pyexpat`). The explicit submodule registration ensures that imports like `from xml.parsers.expat.model import *` work correctly.

## Context
Located in LLDB's vendored libraries, suggesting this provides XML parsing capabilities for debug symbol processing or configuration parsing within the debugger environment.