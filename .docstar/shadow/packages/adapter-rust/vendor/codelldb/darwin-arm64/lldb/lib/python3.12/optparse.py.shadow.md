# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/optparse.py
@source-hash: 07d224301cba312f
@generated: 2026-02-09T18:07:19Z

## Python optparse Module

**Primary Purpose**: Legacy command-line argument parsing library that provides flexible option handling with support for short/long options, value types, callbacks, and help generation.

**Architecture**: Object-oriented design with clear separation between option definitions (`Option`), value storage (`Values`), formatting (`HelpFormatter`), and parsing logic (`OptionParser`).

### Core Classes

**Option (L449-817)**: Represents a single command-line option with comprehensive validation and processing.
- Constructor validates option strings, attributes, and interdependencies via `CHECK_METHODS` (L733-739)
- Supports multiple actions: store, store_const, store_true/false, append, count, callback, help, version (L486-495)
- Type checking via `TYPE_CHECKER` dict (L543-548) with built-in support for int, long, float, complex, choice
- Value processing through `process()` (L775) and `take_action()` (L787) methods

**OptionParser (L1106-1649)**: Main parsing engine that processes command-line arguments.
- Inherits from `OptionContainer` for option management
- Key parsing methods: `_process_args()` (L1407), `_process_long_opt()` (L1467), `_process_short_opts()` (L1503)
- Supports interspersed arguments via `allow_interspersed_args` flag (L1194)
- Thread-unsafe due to shared state in `rargs`, `largs`, `values` attributes (L1169-1172)

**Values (L823-886)**: Container for parsed option values with dictionary-like behavior.
- Supports careful/loose update modes via `_update()` (L864)
- Can read defaults from modules (`read_module()` L872) or files (`read_file()` L877)
- `ensure_value()` (L882) provides safe attribute access with defaults

**HelpFormatter (L161-367)**: Abstract base for help text generation with concrete subclasses.
- `IndentedHelpFormatter` (L368-385): Default formatter with indented sections
- `TitledHelpFormatter` (L387-404): Alternative with underlined headings
- Handles terminal width detection and text wrapping

### Key Functions

**Type Converters**:
- `_parse_num()` (L406-417): Handles hex (0x), binary (0b), octal (0), and decimal parsing
- `check_builtin()` (L427-433): Validates and converts built-in types
- `check_choice()` (L435-442): Validates choice options

**Utility Functions**:
- `_match_abbrev()` (L1652-1674): Resolves option abbreviations with ambiguity detection
- `make_option` (L1681): Factory function alias to `Option` class

### Exception Hierarchy

- `OptParseError` (L103-108): Base exception class
- `OptionError` (L111-125): Invalid option configuration
- `OptionConflictError` (L127-130): Conflicting option strings
- `OptionValueError` (L132-136): Invalid option values
- `BadOptionError` (L138-146): Unknown options
- `AmbiguousOptionError` (L148-158): Ambiguous option abbreviations

### Important Constants

- `NO_DEFAULT` (L446): Sentinel for unspecified defaults
- `SUPPRESS_HELP`/`SUPPRESS_USAGE` (L820-821): Constants for suppressing output
- `__all__` (L26-42): Public API exports

### Dependencies

- Standard library: `sys`, `os`, `textwrap`
- Optional: `gettext` for internationalization (L89-100)

### Notable Patterns

- Extensive use of class attributes for configuration (`ACTIONS`, `TYPES`, `CHECK_METHODS`)
- Template method pattern in `HelpFormatter` with abstract methods
- Strategy pattern for conflict resolution ("error" vs "resolve")
- Internationalization support with fallback implementations