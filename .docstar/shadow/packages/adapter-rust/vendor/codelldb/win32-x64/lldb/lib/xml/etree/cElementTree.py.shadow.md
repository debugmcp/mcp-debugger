# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/xml/etree/cElementTree.py
@source-hash: d0f57acab07fe4f9
@generated: 2026-02-09T18:06:04Z

## Primary Purpose
Deprecated compatibility module that provides a transparent alias for `xml.etree.ElementTree`. This file exists to maintain backward compatibility for code that imports from the legacy `xml.etree.cElementTree` module path.

## Key Elements
- **Wildcard import (L3)**: Re-exports all public symbols from `xml.etree.ElementTree` using `from xml.etree.ElementTree import *`
- **Deprecation notice (L1)**: Comment indicating this is a deprecated alias

## Dependencies
- **xml.etree.ElementTree**: Core dependency that provides all actual functionality

## Architectural Context
This is a shim module following Python's deprecation pattern for the cElementTree module. In Python 3.3+, the C implementation was merged into ElementTree, making cElementTree redundant. This file allows legacy code to continue working without modification while the underlying implementation uses the modern unified ElementTree module.

## Usage Pattern
Acts as a transparent pass-through - any code importing from this module will receive the same API as importing directly from `xml.etree.ElementTree`.