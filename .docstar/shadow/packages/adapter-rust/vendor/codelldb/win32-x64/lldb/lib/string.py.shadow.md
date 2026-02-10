# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/string.py
@source-hash: 24aeae1f0526250f
@generated: 2026-02-09T18:13:09Z

## Purpose
Standard Python string module providing ASCII character constants and string processing utilities. This is a vendored copy within LLDB's Python environment for the Rust adapter.

## Key Components

### String Constants (L24-32)
- `whitespace` - All ASCII whitespace characters
- `ascii_lowercase/ascii_uppercase/ascii_letters` - Character classification sets
- `digits/hexdigits/octdigits` - Number digit sets  
- `punctuation` - ASCII punctuation characters
- `printable` - All printable ASCII characters (combination of above)

### String Utilities

#### `capwords()` (L37-48)
Capitalizes words in a string with optional separator control. Uses split/capitalize/join pattern.

#### `Template` Class (L57-175)
String template engine supporting `$variable` and `${variable}` substitution patterns.

**Key attributes:**
- `delimiter = '$'` (L60)
- `idpattern` - Regex for valid identifiers (L65)
- `pattern` - Compiled regex for template matching (built in `__init_subclass__()`)

**Core methods:**
- `substitute()` (L104-121) - Strict substitution, raises KeyError on missing variables
- `safe_substitute()` (L123-142) - Lenient substitution, leaves unmatched variables unchanged
- `is_valid()` (L144-155) - Validates template syntax
- `get_identifiers()` (L157-171) - Extracts unique variable names from template

**Pattern matching groups:**
- `escaped` - Double delimiter (`$$`)
- `named` - Simple variable (`$var`) 
- `braced` - Braced variable (`${var}`)
- `invalid` - Malformed syntax

#### `Formatter` Class (L188-309)
Advanced string formatting engine implementing PEP 3101 format string specification.

**Core methods:**
- `format()` (L189-190) - Main entry point
- `vformat()` (L192-196) - Internal formatting with argument tracking
- `_vformat()` (L198-249) - Recursive formatting implementation
- `get_field()` (L296-309) - Field resolution with attribute/index access
- `convert_field()` (L267-277) - Type conversions (`!s`, `!r`, `!a`)

**Dependencies:**
- `_string` module for C-level parsing functions
- `_re` for regex compilation
- `_ChainMap` from collections for argument mapping

## Architecture Notes
- Uses sentinel pattern (`_sentinel_dict`) for parameter defaults
- Template class uses `__init_subclass__()` for pattern compilation
- Formatter implements recursion depth limiting (max depth 2)
- Both Template and Formatter support mixed positional/keyword arguments via ChainMap