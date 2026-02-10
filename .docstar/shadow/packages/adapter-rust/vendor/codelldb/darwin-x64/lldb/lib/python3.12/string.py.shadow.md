# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/string.py
@source-hash: 24aeae1f0526250f
@generated: 2026-02-09T18:08:08Z

## Purpose
Standard Python `string` module providing string constants and utility classes for string manipulation. Part of Python's core library, bundled in an LLDB/debugger environment.

## Key Components

### String Constants (L24-32)
- `whitespace` (L24): ASCII whitespace characters ` \t\n\r\v\f`
- `ascii_lowercase` (L25): `'abcdefghijklmnopqrstuvwxyz'`
- `ascii_uppercase` (L26): `'ABCDEFGHIJKLMNOPQRSTUVWXYZ'`
- `ascii_letters` (L27): Combined lowercase + uppercase
- `digits` (L28): `'0123456789'`
- `hexdigits` (L29): Decimal digits + hex letters (a-f, A-F)
- `octdigits` (L30): `'01234567'`
- `punctuation` (L31): All ASCII punctuation characters
- `printable` (L32): Combined digits + letters + punctuation + whitespace

### Utility Functions
- `capwords(s, sep=None)` (L37-48): Capitalizes words in string, using split/capitalize/join pattern

### Template Class (L57-176)
String templating engine supporting `$` variable substitution with three formats:
- `$identifier`: Simple variable substitution
- `${identifier}`: Braced identifiers
- `$$`: Escaped dollar sign

**Key attributes:**
- `delimiter` (L60): `'$'` - substitution marker
- `idpattern` (L65): Regex pattern for valid identifiers
- `pattern` (L85): Compiled regex for parsing templates

**Core methods:**
- `substitute(mapping, **kws)` (L104-121): Strict substitution, raises KeyError for missing variables
- `safe_substitute(mapping, **kws)` (L123-142): Lenient substitution, leaves unmatched variables unchanged
- `is_valid()` (L144-155): Validates template syntax
- `get_identifiers()` (L157-171): Extracts all variable names from template

### Formatter Class (L188-309)
Advanced string formatting engine implementing Python's format string syntax (PEP 3101).

**Key methods:**
- `format(format_string, *args, **kwargs)` (L189-190): Public interface
- `vformat(format_string, args, kwargs)` (L192-196): Core formatting logic with argument tracking
- `_vformat()` (L198-249): Recursive formatter with depth protection
- `get_field(field_name, args, kwargs)` (L296-309): Resolves field references including attribute/index access
- `convert_field(value, conversion)` (L267-277): Handles conversion specifiers (`!s`, `!r`, `!a`)

## Dependencies
- `_string`: C extension module providing core parsing functions
- `re`: Regular expressions for Template pattern matching
- `collections.ChainMap`: For mapping parameter handling

## Architecture Notes
- Template uses `__init_subclass__()` hook (L69-85) for pattern compilation in subclasses
- Formatter delegates parsing to C implementation via `_string` module
- Both classes support recursive/nested operations with depth limits
- Template pattern compilation is deferred until class finalization (L175)

## Critical Invariants
- Template patterns must handle all regex groups (named, braced, escaped, invalid)
- Formatter maintains argument usage tracking to detect unused parameters
- Recursion depth limits prevent infinite expansion in nested formats