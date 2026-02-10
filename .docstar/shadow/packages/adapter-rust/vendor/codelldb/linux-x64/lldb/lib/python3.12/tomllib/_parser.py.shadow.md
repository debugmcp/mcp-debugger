# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/tomllib/_parser.py
@source-hash: 4579b04a75664523
@generated: 2026-02-09T18:06:18Z

## Primary Purpose
TOML parser implementation providing `load()` and `loads()` functions for parsing TOML documents into Python dictionaries. This is the core parsing module of Python's `tomllib` library.

## Key Components

### Entry Points
- `load(fp: BinaryIO, parse_float: ParseFloat = float) -> dict[str, Any]` (L57): Parses TOML from binary file object
- `loads(s: str, parse_float: ParseFloat = float) -> dict[str, Any]` (L69): Main parsing function for TOML strings

### Core Data Structures
- `NestedDict` (L193-225): Manages hierarchical dictionary structure with `get_or_create_nest()` and `append_nest_to_list()` methods
- `Flags` (L135-191): Tracks namespace state with `FROZEN` and `EXPLICIT_NEST` flags to prevent invalid overwrites
- `Output` (L227-229): NamedTuple combining NestedDict and Flags for parser state
- `TOMLDecodeError` (L53): Custom exception for TOML parsing errors

### Character Set Constants (L22-38)
- `ASCII_CTRL`, `ILLEGAL_BASIC_STR_CHARS`, `TOML_WS`, `BARE_KEY_CHARS`, `KEY_INITIAL_CHARS`
- `BASIC_STR_ESCAPE_REPLACEMENTS` (L40-50): Mapping for escape sequence translation

### Parsing Functions
- `parse_value(src, pos, parse_float) -> tuple[Pos, Any]` (L584): Main value parser with type dispatch
- `parse_key(src, pos) -> tuple[Pos, Key]` (L373): Parses dotted keys
- `parse_array(src, pos, parse_float) -> tuple[Pos, list]` (L412): Array parser
- `parse_inline_table(src, pos, parse_float) -> tuple[Pos, dict]` (L436): Inline table parser
- `parse_basic_str(src, pos, multiline: bool) -> tuple[Pos, str]` (L552): String parser with escape handling
- `parse_literal_str(src, pos) -> tuple[Pos, str]` (L512): Literal string parser
- `parse_multiline_str(src, pos, literal: bool) -> tuple[Pos, str]` (L521): Multiline string parser

### Rule Processing Functions
- `key_value_rule(src, pos, out, header, parse_float) -> Pos` (L323): Handles key=value assignments
- `create_dict_rule(src, pos, out) -> tuple[Pos, Key]` (L284): Processes [table] declarations
- `create_list_rule(src, pos, out) -> tuple[Pos, Key]` (L302): Processes [[array.of.tables]] declarations

### Utility Functions
- `skip_chars(src, pos, chars) -> Pos` (L232): Character sequence skipping
- `skip_until(src, pos, expect, error_on, error_on_eof) -> Pos` (L241): Skip until delimiter with validation
- `suffixed_err(src, pos, msg) -> TOMLDecodeError` (L652): Error creation with position context
- `make_safe_parse_float(parse_float) -> ParseFloat` (L673): Decorator ensuring parse_float safety

## Architecture Patterns
- **State Machine**: Main `loads()` function implements line-by-line parsing state machine
- **Position Tracking**: All parsing functions return `(new_position, parsed_value)` tuples
- **Immutability Enforcement**: Flags system prevents modification of inline tables/arrays
- **Error Recovery**: Comprehensive error messages with line/column information

## Dependencies
- Imports regex patterns and conversion functions from `._re` module (L12-19)
- Uses type definitions from `._types` module (L20)

## Critical Invariants
- Position must always advance or parsing terminates
- Frozen namespaces (inline tables/arrays) cannot be mutated
- Explicit nests cannot be redeclared with table syntax
- Parse functions maintain consistent `(pos, value)` return signature