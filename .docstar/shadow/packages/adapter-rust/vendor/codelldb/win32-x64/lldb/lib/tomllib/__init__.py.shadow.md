# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/tomllib/__init__.py
@source-hash: 71f67036895f4c5a
@generated: 2026-02-09T18:11:09Z

**Primary Purpose**: Public API module for TOML parsing functionality, serving as the entry point for the tomllib library.

**Key Components**:
- **Public API exports (L5)**: Exposes three core symbols - `loads`, `load`, and `TOMLDecodeError`
- **Core imports (L7)**: Imports actual implementation from `_parser` module including:
  - `TOMLDecodeError`: Exception class for TOML parsing errors
  - `load`: Function to parse TOML from file-like objects
  - `loads`: Function to parse TOML from strings
- **Module attribution fix (L10)**: Adjusts `TOMLDecodeError.__module__` to make the exception appear as if it originates from this public module rather than the internal `_parser` module

**Architecture Pattern**: Classic Python package structure using `__init__.py` as a facade that re-exports implementation details from private modules while presenting a clean public interface.

**Dependencies**: Relies on internal `_parser` module for actual TOML parsing logic.

**Key Insight**: This is a minimal public interface module that follows Python conventions by hiding implementation details behind a clean API surface.