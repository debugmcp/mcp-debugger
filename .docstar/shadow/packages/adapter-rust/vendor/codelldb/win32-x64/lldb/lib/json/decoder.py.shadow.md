# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/json/decoder.py
@source-hash: 9f02654649816145
@generated: 2026-02-09T18:11:14Z

## Core Purpose
JSON decoder implementation providing Python's JSON parsing functionality with error handling, custom hooks, and UTF-16 surrogate pair support. This is a complete JSON parser with both C extension fallback and pure Python implementation.

## Key Components

### Exception Handling
- **JSONDecodeError (L20-44)**: Specialized ValueError subclass providing detailed error context including position, line/column numbers, and original document for precise error reporting

### String Processing
- **py_scanstring (L69-126)**: Pure Python JSON string parser handling escape sequences, Unicode, and UTF-16 surrogate pairs. Core algorithm processes string chunks, validates escape sequences, and reconstructs decoded strings
- **_decode_uXXXX (L59-67)**: Helper function for parsing Unicode escape sequences (\uXXXX format)
- **scanstring (L130)**: Adaptive string scanner using C extension when available, falling back to pure Python

### Data Structure Parsers
- **JSONObject (L136-215)**: Object/dictionary parser handling key-value pairs, whitespace, separators, and custom object hooks. Implements memo optimization for string deduplication
- **JSONArray (L217-251)**: Array/list parser managing comma-separated values with whitespace handling

### Main Decoder Class
- **JSONDecoder (L254-330)**: Primary decoder class with configurable parsing hooks
  - **__init__ (L284-329)**: Configures custom parsers for floats, integers, constants, and object transformation hooks
  - **decode (L332-341)**: Complete document parser ensuring no trailing data
  - **raw_decode (L343-356)**: Partial document parser returning remainder position

## Constants and Configuration
- **_CONSTANTS (L46-50)**: Maps special JSON values (NaN, Infinity, -Infinity) to Python float equivalents
- **BACKSLASH (L54-57)**: Escape sequence mapping table for common JSON escapes
- **WHITESPACE patterns (L132-133)**: Regex and string constants for JSON whitespace handling

## Dependencies
- Uses `json.scanner` module for core scanning functionality
- Optional C extension `_json.scanstring` for performance optimization
- Standard library `re` module for pattern matching

## Architecture Patterns
- Fallback pattern: C extension preferred, pure Python as backup
- Hook-based customization for type conversion and object construction
- Memo pattern for string interning optimization
- Error chaining with detailed position tracking

## Critical Invariants
- All parsers return (result, end_position) tuples for consistent position tracking
- UTF-16 surrogate pair handling maintains Unicode compliance
- Strict mode controls whether control characters are allowed in strings
- Scanner integration ensures consistent tokenization across all parse functions