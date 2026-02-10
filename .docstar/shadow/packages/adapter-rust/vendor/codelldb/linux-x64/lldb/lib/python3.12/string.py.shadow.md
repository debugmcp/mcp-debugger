# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/string.py
@source-hash: 24aeae1f0526250f
@generated: 2026-02-09T18:10:06Z

## Purpose
Standard Python string utilities module providing ASCII character constants, string formatting, and template substitution capabilities. Part of the Python 3.12 standard library bundled with LLDB debugger.

## Core Components

### String Constants (L24-32)
Pre-defined ASCII character sets for classification and validation:
- `whitespace`: space, tab, newline, carriage return, vertical tab, form feed
- `ascii_lowercase/uppercase/letters`: alphabetic characters  
- `digits/hexdigits/octdigits`: numeric character sets
- `punctuation`: all ASCII punctuation marks
- `printable`: combination of all printable ASCII characters

### capwords Function (L37-48)
Utility function for title-case string formatting with configurable word separators. Splits on whitespace by default, capitalizes each word, rejoins with single spaces.

### Template Class (L57-175)
Dollar-sign based string template system supporting:
- **Pattern Matching (L65-85)**: Regex-based identifier recognition with `$identifier` and `${identifier}` syntax
- **substitute() (L104-121)**: Strict substitution that raises KeyError for missing variables
- **safe_substitute() (L123-142)**: Lenient substitution leaving unmatched placeholders intact
- **Validation Methods**: `is_valid()` (L144-155) and `get_identifiers()` (L157-171)

Key attributes:
- `delimiter`: substitution trigger character (default '$')
- `idpattern`: regex for valid identifiers  
- `pattern`: compiled regex for template parsing

### Formatter Class (L188-309)
Advanced string formatting engine implementing Python's format string specification:
- **format()/vformat() (L189-196)**: Main formatting entry points
- **_vformat() (L198-249)**: Recursive formatting engine handling nested format specs
- **Field Resolution**: `get_field()` (L296-309) resolves dotted/indexed field names
- **Type Conversion**: `convert_field()` (L267-277) handles 's', 'r', 'a' conversion types
- **Parsing Integration**: Uses `_string` module's C implementations for performance

## Dependencies
- `_string`: C module providing core parsing functions
- `re`: Regular expressions for Template pattern matching  
- `collections.ChainMap`: Mapping composition for Template substitution

## Architecture Notes
- Template uses `__init_subclass__()` (L69-85) for automatic pattern compilation in subclasses
- Formatter delegates parsing to optimized C implementations while handling high-level logic
- Recursion depth protection prevents infinite loops in nested format specifications
- Automatic/manual field indexing state machine prevents mixing indexing styles