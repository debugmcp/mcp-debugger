# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/configparser.py
@source-hash: 8d822edd41d1085e
@generated: 2026-02-09T18:07:14Z

## Purpose
Standard Python configparser module - parses INI-style configuration files with sections, options, and value interpolation. Provides hierarchical configuration management with support for defaults, type conversion, and multiple input sources.

## Core Classes

**Error (L169-179)** - Base exception class for all configparser errors. Stores message and provides string representation.

**Exception Hierarchy**:
- **NoSectionError (L182-188)** - Section not found
- **DuplicateSectionError (L191-214)** - Duplicate sections in strict mode  
- **DuplicateOptionError (L217-241)** - Duplicate options in strict mode
- **NoOptionError (L244-252)** - Option not found in section
- **InterpolationError (L255-262)** - Base for value interpolation errors
- **InterpolationMissingOptionError (L265-274)** - Missing interpolation reference
- **InterpolationSyntaxError (L277-282)** - Invalid interpolation syntax
- **InterpolationDepthError (L285-295)** - Recursive interpolation limit exceeded
- **ParsingError (L298-310)** - Invalid configuration file syntax
- **MissingSectionHeaderError (L312-323)** - Key-value pair without section header

## Interpolation Classes

**Interpolation (L332-346)** - Base class that passes values through unchanged. Defines hooks: `before_get`, `before_set`, `before_read`, `before_write`.

**BasicInterpolation (L348-418)** - Classic `%(name)s` style interpolation. Uses regex `_KEYCRE` (L363) to find references within same section or DEFAULT section. Implements recursive expansion with depth limit.

**ExtendedInterpolation (L420-491)** - Advanced `${section:option}` syntax supporting cross-section references. Uses `_KEYCRE` regex (L424) and path parsing for section:option syntax.

**LegacyInterpolation (L494-538)** - Deprecated interpolation from old versions. Issues deprecation warning and will be removed in Python 3.13.

## Main Parser Classes  

**RawConfigParser (L541-1173)** - Core parser without interpolation. Extends `MutableMapping`.

Key attributes:
- `_sections` (L590) - Dictionary of section data
- `_defaults` (L591) - Default section values  
- `_proxies` (L593-594) - SectionProxy objects for dict-like access
- `_interpolation` (L612-616) - Interpolation handler
- `_converters` (L592) - Type conversion methods

Key regex patterns:
- `SECTCRE` (L570) - Matches `[section]` headers
- `OPTCRE` (L572) - Matches `key=value` pairs  
- `OPTCRE_NV` (L575) - Matches options with optional values
- `NONSPACECRE` (L577) - Finds leading whitespace

Core methods:
- `read*` methods (L665-741) - Parse from files, strings, dicts
- `get*` methods (L743-807) - Retrieve values with type conversion
- `set` (L869-881) - Set option values
- `_read` (L974-1096) - Main parsing logic with state machine
- `_join_multiline_values` (L1098-1108) - Process continuation lines

**ConfigParser (L1175-1204)** - Extends RawConfigParser with BasicInterpolation by default and type validation.

## Helper Classes

**SectionProxy (L1207-1275)** - Dict-like interface to individual sections. Dynamically creates getter methods for converters (L1214-1217).

**ConverterMapping (L1277-1333)** - Manages type converter methods. Auto-discovers `get*` methods and enables dynamic addition of converters.

## Constants

- `DEFAULTSECT = "DEFAULT"` (L162) - Special section name for defaults
- `MAX_INTERPOLATION_DEPTH = 10` (L164) - Recursion limit for interpolation
- `_UNSET` (L329) - Sentinel for distinguishing None from missing values

## Key Patterns

1. **State Machine Parsing**: `_read` method uses cursect/sectname/optname state tracking
2. **Interpolation Pipeline**: Values pass through before_get/before_set/before_read/before_write hooks
3. **Layered Lookups**: ChainMap provides vars > section > defaults precedence
4. **Dynamic Method Creation**: Converters and SectionProxy use functools.partial for getter methods
5. **Strict Mode**: Optional duplicate detection during parsing