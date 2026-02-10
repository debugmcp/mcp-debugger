# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/xml/__init__.py
@source-hash: 34296f728e7fe68c
@generated: 2026-02-09T18:06:04Z

## Primary Purpose
Python standard library XML package initialization file that exposes four core XML processing sub-packages as a unified namespace.

## Key Components
- **__all__ declaration (L20)**: Explicitly exports four sub-packages: `dom`, `parsers`, `sax`, and `etree`
- **Module docstring (L1-17)**: Comprehensive documentation describing each sub-package's purpose and capabilities

## Sub-package Overview
- **dom**: W3C Document Object Model implementation with Level 1 + Namespaces support
- **parsers**: Python wrappers for XML parsers (currently Expat-based)
- **sax**: Simple API for XML (SAX 2) implementation ported from Java/XML-Dev
- **etree**: ElementTree XML library subset for tree-based XML processing

## Architectural Role
Standard library package entry point that provides organized access to Python's XML processing capabilities. Follows Python package convention by defining public API through `__all__` while relying on actual implementations in sub-packages.

## Dependencies
None explicitly imported - acts as namespace organizer for sub-packages that contain the actual XML processing implementations.