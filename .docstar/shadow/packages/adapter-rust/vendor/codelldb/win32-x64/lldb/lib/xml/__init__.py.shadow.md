# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/xml/__init__.py
@source-hash: 34296f728e7fe68c
@generated: 2026-02-09T18:11:17Z

## Purpose
Package initialization file for Python's core XML support library, providing a unified entry point to four major XML processing sub-packages.

## Structure
- **Module docstring (L1-17)**: Comprehensive description of the four XML sub-packages:
  - `dom`: W3C Document Object Model implementation with Level 1 + Namespaces support
  - `parsers`: XML parser wrappers (currently Expat-focused)
  - `sax`: Simple API for XML (SAX 2) implementation
  - `etree`: ElementTree XML library subset

- **Public API (L20)**: `__all__` list explicitly exports the four sub-package names for controlled imports

## Architecture Notes
This is a standard Python package `__init__.py` that serves as a namespace organizer rather than implementing functionality. It follows the common pattern of using `__all__` to define the public interface while relying on the actual implementations in the referenced sub-packages.

## Dependencies
- Implicit dependencies on the four sub-packages: `dom`, `parsers`, `sax`, and `etree`
- Part of Python's standard library XML processing ecosystem