# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/tomllib/__init__.py
@source-hash: 71f67036895f4c5a
@generated: 2026-02-09T18:06:06Z

**Primary Purpose**: Package initialization module for the `tomllib` TOML parsing library, providing the public API interface for TOML document parsing functionality.

**Key Components**:
- **Public API Exports** (L5): Defines the complete public interface through `__all__` tuple containing `loads`, `load`, and `TOMLDecodeError`
- **Core Imports** (L7): Imports all primary functionality from `_parser` module including:
  - `TOMLDecodeError`: Exception class for TOML parsing errors
  - `load`: Function for parsing TOML from file-like objects
  - `loads`: Function for parsing TOML from strings
- **Module Attribution Fix** (L10): Modifies `TOMLDecodeError.__module__` to appear as if the exception was defined in this package rather than the internal `_parser` module

**Architecture Pattern**: 
- Follows Python package convention of separating public API (this `__init__.py`) from implementation (`_parser` module)
- Uses module attribute manipulation to provide clean exception namespace for public consumption

**Dependencies**: 
- Internal dependency on `._parser` module for all core functionality
- Part of Python 3.12 standard library (tomllib package)

**Critical Notes**:
- This is a thin wrapper/facade module - all actual implementation resides in `_parser`
- Exception module attribution ensures proper error reporting and introspection for library users
- Located within LLDB's Python distribution, suggesting use in debugging/development tools context