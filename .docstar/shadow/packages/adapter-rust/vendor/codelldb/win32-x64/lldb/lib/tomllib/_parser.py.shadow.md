# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/tomllib/_parser.py
@source-hash: 4579b04a75664523
@generated: 2026-02-09T18:11:24Z

This file implements a complete TOML (Tom's Obvious, Minimal Language) parser that converts TOML documents into Python dictionaries.

## Primary Purpose
Core parser for TOML format, providing two main entry points: `load()` for binary file objects and `loads()` for string parsing. Part of the `tomllib` package which is a backport of Python 3.11's standard library TOML parser.

## Key Classes

**TOMLDecodeError (L53-54)**: Custom exception for TOML parsing errors, inherits from ValueError.

**Flags (L135-191)**: Manages parsing state flags for namespaces and keys. Tracks frozen (immutable) namespaces and explicit nests that cannot be redeclared. Key methods:
- `add_pending()` (L148): Queue flags for later application
- `finalize_pending()` (L151): Apply queued flags
- `set()` (L164): Set flags with recursive option
- `is_()` (L175): Check if key has specific flag

**NestedDict (L193-225)**: Manages the hierarchical dictionary structure being built during parsing. Key methods:
- `get_or_create_nest()` (L198): Navigate/create nested dictionary structure
- `append_nest_to_list()` (L215): Handle array of tables syntax

**Output (L227-229)**: NamedTuple combining NestedDict and Flags for parser state.

## Core Parsing Functions

**loads() (L69-132)**: Main string parser implementing the TOML specification. Uses a state machine approach parsing one statement per iteration, handling:
- Key/value pairs
- Table declarations `[table]`
- Array of tables `[[array]]`
- Comments and whitespace

**load() (L57-66)**: Binary file wrapper that decodes to UTF-8 then calls `loads()`.

**parse_value() (L584-649)**: Central value parser routing to specific parsers based on first character. Handles all TOML value types with optimized ordering.

## Key Parsing Components

**Key Parsing**:
- `parse_key()` (L373): Parse dotted keys like `a.b.c`
- `parse_key_part()` (L391): Parse individual key components (bare, quoted, or literal)

**String Parsing**:
- `parse_basic_str()` (L552): Parse quoted strings with escape sequences
- `parse_literal_str()` (L512): Parse single-quoted literal strings
- `parse_multiline_str()` (L521): Parse triple-quoted multiline strings
- `parse_basic_str_escape()` (L468): Handle escape sequences in basic strings

**Container Parsing**:
- `parse_array()` (L412): Parse TOML arrays with nested value support
- `parse_inline_table()` (L436): Parse inline tables `{key = value}`

**Rule Functions**:
- `key_value_rule()` (L323): Process key=value assignments with namespace validation
- `create_dict_rule()` (L284): Process `[table]` declarations
- `create_list_rule()` (L302): Process `[[array]]` declarations

## Important Dependencies
- `._re`: Regular expressions for datetime and number parsing
- `._types`: Type definitions (Key, ParseFloat, Pos)
- Built-in modules: string, collections.abc, types, typing

## Constants and Character Sets
Defines multiple character sets for validation (L22-38):
- ASCII control character restrictions for different contexts
- Whitespace definitions (`TOML_WS`, `TOML_WS_AND_NEWLINE`)
- Valid characters for bare keys (`BARE_KEY_CHARS`)
- Escape sequence mappings (`BASIC_STR_ESCAPE_REPLACEMENTS`)

## Error Handling
Comprehensive error reporting with `suffixed_err()` (L652) providing line/column information. Validates TOML constraints like immutable namespaces and prevents value overwrites.

## Architecture Notes
- Uses position-based parsing (Pos type) for precise error reporting
- Implements TOML's complex namespace rules preventing redefinition
- Handles both inline and multiline variants of strings and tables
- Optimized character-first parsing in `parse_value()` for performance