# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/string.py
@source-hash: 24aeae1f0526250f
@generated: 2026-02-09T18:09:12Z

## Python `string` Module

**Primary Purpose**: Standard library module providing string constants and formatting utilities. Essential for text processing, template substitution, and string formatting operations.

### String Constants (L24-32)
Pre-defined character classification constants:
- `whitespace` (L24): ASCII whitespace characters (' \t\n\r\v\f')
- `ascii_lowercase/ascii_uppercase/ascii_letters` (L25-27): Letter sets
- `digits/hexdigits/octdigits` (L28-30): Numeric character sets  
- `punctuation` (L31): All ASCII punctuation
- `printable` (L32): Combined printable ASCII characters

### Utility Functions
- `capwords(s, sep=None)` (L37-48): Capitalizes words in string, splits on separator (default whitespace), joins with single spaces

### Template Class (L57-175)
**Purpose**: Dollar-sign based string templating with variable substitution

**Key Attributes**:
- `delimiter = '$'` (L60): Template variable prefix
- `idpattern` (L65): Regex for valid identifiers  
- `pattern` (L85): Compiled regex for template parsing (auto-generated in `__init_subclass__`)

**Core Methods**:
- `substitute(mapping, **kws)` (L104-121): Strict substitution, raises KeyError for missing variables
- `safe_substitute(mapping, **kws)` (L123-142): Safe substitution, leaves missing variables unchanged
- `is_valid()` (L144-155): Validates template syntax
- `get_identifiers()` (L157-171): Extracts all variable names from template

**Template Patterns**: Supports `$var`, `${var}`, and `$$` (escape) syntax

### Formatter Class (L188-309)  
**Purpose**: Advanced string formatting implementation (PEP 3101 format strings)

**Key Methods**:
- `format(format_string, *args, **kwargs)` (L189-190): Public formatting interface
- `vformat(format_string, args, kwargs)` (L192-196): Internal formatting with validation
- `_vformat()` (L198-249): Recursive formatting engine with depth protection
- `get_field(field_name, args, kwargs)` (L296-308): Field resolution with attribute/item access
- `convert_field(value, conversion)` (L267-277): Handles !s, !r, !a conversions

**Dependencies**: 
- `_string` module (L21): C implementation for performance-critical parsing
- `re` (L52): Regex for Template pattern matching
- `collections.ChainMap` (L53): Mapping chain for Template parameter resolution

**Architecture Notes**:
- Template uses metaclass-like `__init_subclass__` pattern for regex compilation
- Formatter delegates parsing to C implementation via `_string.formatter_parser`
- Both classes support extensibility through method overriding
- Recursion protection in Formatter prevents infinite expansion