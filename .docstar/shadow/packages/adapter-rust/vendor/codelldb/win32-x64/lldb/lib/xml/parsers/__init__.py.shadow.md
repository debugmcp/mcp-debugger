# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/xml/parsers/__init__.py
@source-hash: b88497adc30d5d5e
@generated: 2026-02-09T18:06:05Z

## Purpose
Package initialization file for XML parsers module within LLDB's Python interface. Serves as the entry point for XML parsing functionality, specifically providing access to Expat parser bindings.

## Structure
- **Module docstring (L1-8)**: Documents the package's purpose and available submodules
- **Single submodule**: `expat` - Python wrapper for James Clark's Expat XML parser with namespace support

## Key Dependencies
- **Expat parser**: James Clark's C-based XML parser library
- **Namespace support**: Enhanced XML parsing with XML namespace handling

## Architectural Role
This is a standard Python package `__init__.py` file that:
- Defines the public interface for the `xml.parsers` package
- Documents available XML parsing modules (currently only Expat)
- Provides entry point for XML processing within LLDB's Python environment

## Context
Located within LLDB's vendor directory structure, indicating this is a bundled/vendored XML parsing capability for the debugger's Python scripting interface. The minimal implementation suggests other XML parsing modules may be added in the future.