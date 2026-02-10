# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/optparse.py
@source-hash: 07d224301cba312f
@generated: 2026-02-09T18:10:04Z

## Purpose & Responsibility

Legacy command-line option parser module for Python, providing comprehensive option parsing capabilities. This is Python's deprecated `optparse` module (superseded by `argparse` in Python 2.7+). Contains classes for defining, parsing, and formatting command-line options with support for various action types, value validation, and help generation.

## Core Classes & Architecture

**Option (L449-817)**: Core option definition class with extensive validation
- Attributes: `_short_opts`, `_long_opts`, `action`, `type`, `dest`, `default`, etc. (L471-482)
- Action types: "store", "store_const", "store_true", "store_false", "append", "count", "callback", "help", "version" (L486-495)  
- Type system with built-in converters for int, float, complex, choice (L543-548)
- Validation methods: `_check_action()`, `_check_type()`, `_check_choice()`, etc. (L632-739)
- Processing: `process()` (L775), `take_action()` (L787-815)

**OptionParser (L1106-1649)**: Main parser class inheriting from OptionContainer
- Core parsing: `parse_args()` (L1355), `_process_args()` (L1407), `_process_long_opt()` (L1467), `_process_short_opts()` (L1503)
- Configuration: `allow_interspersed_args`, `process_default_values` (L1194-1195)
- Help/error handling: `print_help()` (L1639), `error()` (L1561), `exit()` (L1556)

**OptionContainer (L888-1075)**: Abstract base for option management
- Option storage: `add_option()` (L995), `remove_option()` (L1039)
- Conflict resolution: `_check_conflict()` (L968) with "error" or "resolve" strategies
- Help formatting: `format_option_help()` (L1055)

**OptionGroup (L1076-1104)**: Grouped options for better help organization
- Inherits from OptionContainer, shares option mappings with parent parser

**Values (L823-886)**: Container for parsed option values
- Dict-like interface with attribute access
- Update methods: `_update_careful()` (L843), `_update_loose()` (L856)
- File/module loading: `read_file()` (L877), `read_module()` (L872)

## Help Formatting System

**HelpFormatter (L161-367)**: Abstract base class for help formatting
- Layout control: `indent_increment`, `max_help_position`, `width` (L212-221)
- Text formatting: `_format_text()` (L261), `expand_default()` (L286)
- Option string generation: `format_option_strings()` (L349)

**IndentedHelpFormatter (L368-385)**: Default formatter with indented sections
**TitledHelpFormatter (L387-404)**: Alternative with underlined section headers

## Exception Hierarchy

- `OptParseError (L103)`: Base exception
  - `OptionError (L111)`: Invalid option configuration  
  - `OptionConflictError (L127)`: Conflicting option strings
  - `OptionValueError (L132)`: Invalid option values
  - `BadOptionError (L138)`: Unrecognized options
  - `AmbiguousOptionError (L148)`: Ambiguous option abbreviations

## Key Utility Functions

- `check_choice()` (L435): Validates choice options
- `check_builtin()` (L427): Built-in type conversion with error handling  
- `_parse_num()` (L406): Number parsing supporting hex/binary/octal
- `_match_abbrev()` (L1652): Option abbreviation matching with ambiguity detection
- `make_option` (L1681): Factory function alias for Option class

## Dependencies & Constants

- External: `sys`, `os`, `textwrap`, optional `gettext` for i18n (L76-100)
- Constants: `NO_DEFAULT` (L446), `SUPPRESS_HELP`/`SUPPRESS_USAGE` (L820-821)
- Module metadata: `__version__ = "1.5.3"`, extensive `__all__` exports (L24-42)

## Usage Patterns

Primary workflow: Create OptionParser → Add options → Call parse_args() → Access Values object
Supports GNU-style long options (--option), short options (-o), option clustering (-abc), and both = and space value assignment.