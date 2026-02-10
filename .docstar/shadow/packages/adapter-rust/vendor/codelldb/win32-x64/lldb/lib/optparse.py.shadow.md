# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/optparse.py
@source-hash: 07d224301cba312f
@generated: 2026-02-09T18:13:08Z

## optparse.py - Command-line option parsing library

**Primary Purpose**: Provides a comprehensive command-line option parsing framework with support for short/long options, type checking, help generation, and flexible option handling.

### Core Architecture

**Option (L449-817)**: Central class representing individual command-line options with extensive validation and processing capabilities.
- Supports multiple option string formats (-x, --long-option)
- Type system with built-in converters for int, float, complex, choice (L525, L543-548)
- Action system: store, store_const, store_true/false, append, count, callback, help, version (L486-495)
- Comprehensive validation via CHECK_METHODS list (L733-739)

**OptionParser (L1106-1649)**: Main parser class that orchestrates option parsing and help generation.
- Inherits from OptionContainer for option management
- Parsing state managed via rargs/largs/values attributes (L1156-1167)
- Support for interspersed arguments (L1135-1146)
- Built-in help (-h/--help) and version (--version) options

**OptionContainer (L888-1074)**: Abstract base class providing option storage and conflict resolution.
- Manages option mappings (_short_opt, _long_opt) and defaults (L935-937)
- Conflict handling: "error" or "resolve" modes (L947-950)
- Option addition/removal with validation (L995-1051)

**OptionGroup (L1076-1104)**: Groups related options for organized help display.
- Shares option mappings with parent OptionParser (L1086)
- Provides hierarchical help formatting (L1098-1103)

### Help System

**HelpFormatter (L161-367)**: Abstract base for help text formatting.
- Manages indentation, width, option string formatting
- Template method pattern with abstract format_usage/format_heading

**IndentedHelpFormatter (L368-385)**: Standard indented help format.
**TitledHelpFormatter (L387-404)**: Alternative format with underlined headers.

### Type System & Validation

**Type checking functions** (L406-443):
- `_parse_int()` (L419): Handles hex (0x), binary (0b), octal (0) prefixes
- `check_builtin()` (L427): Validates built-in types
- `check_choice()` (L435): Validates choice constraints

**Values (L823-886)**: Container for parsed option values with update methods.
- Supports careful/loose update modes (L843-871)
- File/module-based configuration loading (L872-881)

### Key Processing Flow

1. **Option Creation**: Option strings validated, attributes set, CHECK_METHODS applied
2. **Parser Setup**: Options added to container, mappings built, help/version added
3. **Parsing**: `parse_args()` processes argv, calls `_process_args()` → `_process_long_opt()`/`_process_short_opts()`
4. **Help Generation**: Formatters create structured help text from option metadata

### Exception Hierarchy

- `OptParseError` (L103): Base exception
- `OptionError` (L111): Option definition problems  
- `OptionConflictError` (L127): Conflicting option strings
- `OptionValueError` (L132): Invalid option values
- `BadOptionError` (L138): Unknown options
- `AmbiguousOptionError` (L148): Ambiguous abbreviations

### Internationalization

Uses gettext for message localization (L89-101) with fallback implementations.

### Key Constants

- `NO_DEFAULT` (L446): Sentinel for unspecified defaults
- `SUPPRESS_HELP`/`SUPPRESS_USAGE` (L820-821): Control help display
- Version "1.5.3" (L24) indicates mature, stable API

This is a feature-complete, production-ready option parsing library with sophisticated validation, flexible formatting, and comprehensive error handling.