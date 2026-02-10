# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/tomllib/
@generated: 2026-02-09T18:16:12Z

## Purpose and Responsibility

The `tomllib` directory provides a complete TOML (Tom's Obvious, Minimal Language) parser implementation that converts TOML documents into Python dictionaries. This is a backport of Python 3.11's standard library TOML parser, packaged for use in earlier Python versions.

## Architecture and Organization

The module follows a clean separation of concerns with specialized components:

- **`__init__.py`**: Public API facade that exports the three core symbols (`loads`, `load`, `TOMLDecodeError`) while hiding implementation details
- **`_parser.py`**: Core parsing engine implementing the complete TOML specification 
- **`_re.py`**: Regular expression utilities for datetime and numeric parsing
- **`_types.py`**: Type definitions providing consistent typing across the parser

## Public API Surface

The module exposes a minimal, intuitive interface:

- **`loads(s)`**: Parse TOML from string input
- **`load(fp)`**: Parse TOML from binary file-like object (UTF-8 decoded)
- **`TOMLDecodeError`**: Exception raised for invalid TOML syntax

## Internal Data Flow

1. Entry points (`load`/`loads`) handle input normalization and UTF-8 decoding
2. Core parser in `_parser.py` uses a statement-by-statement state machine approach
3. Regular expressions in `_re.py` handle complex value parsing (numbers, dates, times)
4. Type definitions in `_types.py` ensure consistent typing for keys, positions, and parsing callbacks
5. Parser builds nested dictionary structure while tracking namespace flags to enforce TOML semantics

## Key Components and Interactions

**Parser Engine** (`_parser.py`):
- `NestedDict`: Manages hierarchical dictionary construction
- `Flags`: Tracks immutable namespaces and prevents redefinition
- Value parsers for all TOML types (strings, numbers, arrays, inline tables)
- Rule processors for table declarations and key-value assignments

**Regex Utilities** (`_re.py`):
- Compiled patterns for ISO 8601 datetimes, times, and TOML numbers
- Conversion functions that transform regex matches to Python objects
- Cached timezone factory for memory efficiency

**Type System** (`_types.py`):
- `Key`: Tuple representation of dotted key paths
- `Pos`: Parser position tracking for error reporting
- `ParseFloat`: Callback interface for numeric parsing

## Important Patterns

- **Error Handling**: Comprehensive error reporting with line/column information via `suffixed_err()`
- **Namespace Validation**: Strict enforcement of TOML's immutability rules preventing value overwrites
- **Performance Optimization**: Character-first parsing dispatch and LRU-cached timezone objects
- **Standards Compliance**: Full implementation of TOML specification including edge cases and constraints

The module provides a robust, well-tested TOML parser suitable for production use, with clean separation between public interface and internal implementation complexity.