# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/tomllib/
@generated: 2026-02-09T18:16:06Z

## Overall Purpose
This directory contains Python's `tomllib` package - a complete TOML (Tom's Obvious Minimal Language) parser implementation that converts TOML documents into Python dictionaries. The module is part of Python 3.12's standard library and is embedded within LLDB's debugging environment, providing TOML parsing capabilities for configuration files and data serialization in development tools.

## Architecture & Component Relationships
The module follows a clean layered architecture with clear separation of concerns:

- **`__init__.py`**: Public API facade that exports the main interface (`load`, `loads`, `TOMLDecodeError`) while hiding implementation details
- **`_parser.py`**: Core parsing engine containing the complete TOML grammar implementation, state management, and error handling
- **`_re.py`**: Utility layer providing regex patterns and type conversion functions for numbers, dates, and times
- **`_types.py`**: Type definitions and interfaces (referenced but not detailed in provided docs)

The components work together through a dependency chain: `__init__.py` → `_parser.py` → `_re.py` → `_types.py`

## Public API Surface
The package exposes three main entry points through `__init__.py`:

1. **`load(fp: BinaryIO, parse_float: ParseFloat = float) -> dict[str, Any]`**: Parses TOML from binary file objects
2. **`loads(s: str, parse_float: ParseFloat = float) -> dict[str, Any]`**: Parses TOML from string input (primary function)
3. **`TOMLDecodeError`**: Exception class for parsing errors with detailed position information

## Internal Organization & Data Flow
The parsing process follows a structured pipeline:

1. **Input Processing**: `loads()` accepts TOML strings and optional float parser
2. **State Management**: Uses `NestedDict` and `Flags` classes to track hierarchical structure and prevent invalid overwrites
3. **Grammar Parsing**: Line-by-line state machine processes tables `[section]`, array tables `[[array]]`, and key-value pairs
4. **Value Parsing**: Type-specific parsers handle strings (basic/literal/multiline), numbers, dates/times, arrays, and inline tables
5. **Type Conversion**: Regular expressions in `_re.py` convert TOML literals to Python objects (int, float, datetime, etc.)
6. **Error Handling**: Position-aware error reporting with line/column information

## Important Patterns & Conventions
- **Position Tracking**: All parsing functions return `(new_position, parsed_value)` tuples ensuring forward progress
- **Immutability Enforcement**: Frozen flags prevent modification of inline tables and arrays after creation
- **Namespace Protection**: Explicit nest tracking prevents redeclaration conflicts between table syntax forms
- **TOML 1.0.0 Compliance**: Full specification support including all data types, escape sequences, and structural rules
- **Error Recovery**: Comprehensive error messages with contextual information for debugging

## Integration Context
Located within LLDB's Python distribution (`packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/tomllib`), this suggests usage in debugging tools, configuration management for development environments, and data exchange in debugging workflows.