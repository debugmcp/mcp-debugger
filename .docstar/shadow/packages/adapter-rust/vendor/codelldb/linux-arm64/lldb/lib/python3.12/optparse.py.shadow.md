# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/optparse.py
@source-hash: 07d224301cba312f
@generated: 2026-02-09T18:09:02Z

## Python optparse Module - Command Line Option Parser

**Primary Purpose**: Complete implementation of command-line option parsing functionality, providing a robust alternative to getopt with support for GNU/POSIX-style options, help generation, and type conversion.

**Core Architecture**:
- `Option` (L449-817): Represents individual command-line options with validation, type conversion, and action processing
- `OptionParser` (L1106-1649): Main parser class that processes command-line arguments and manages option collections
- `OptionContainer` (L888-1074): Abstract base class providing shared option management functionality
- `OptionGroup` (L1076-1103): Groups related options for better help organization
- `Values` (L823-886): Container for parsed option values with dynamic attribute access

**Key Classes and Functions**:

### Exception Hierarchy (L103-159)
- `OptParseError` (L103): Base exception class
- `OptionError` (L111): Invalid option configuration
- `OptionConflictError` (L127): Conflicting option definitions
- `OptionValueError` (L132): Invalid option values during parsing
- `BadOptionError` (L138): Unknown options encountered
- `AmbiguousOptionError` (L148): Ambiguous option abbreviations

### Help Formatting System (L161-404)
- `HelpFormatter` (L161): Abstract base class for help text formatting
- `IndentedHelpFormatter` (L368): Default formatter with indented sections
- `TitledHelpFormatter` (L387): Alternative formatter with underlined headers

### Option Processing (L406-448)
- `_parse_num()` (L406): Numeric parsing with base detection (hex/binary/octal)
- `check_builtin()` (L427): Built-in type validation
- `check_choice()` (L435): Choice validation for enumerated options

**Key Features**:
- **Option Syntax**: Supports both short (-f) and long (--file) options
- **Type System**: Built-in support for int, float, complex, choice types with extensible type checking
- **Actions**: store, store_const, store_true/false, append, count, callback, help, version
- **Conflict Resolution**: Configurable handling of conflicting option definitions
- **Help Generation**: Automatic usage and help text generation with customizable formatting
- **Internationalization**: gettext support for error messages and help text

**Critical Constants**:
- `NO_DEFAULT` (L446): Sentinel value distinguishing unset from None defaults
- `SUPPRESS_HELP`/`SUPPRESS_USAGE` (L820-821): Constants to suppress help/usage display

**Processing Flow**:
1. `OptionParser.parse_args()` (L1355) processes command line
2. `_process_args()` (L1407) handles option/argument separation
3. `_process_long_opt()` (L1467) / `_process_short_opts()` (L1503) parse individual options
4. `Option.process()` (L775) converts values and executes actions
5. Returns `(Values, remaining_args)` tuple

**Dependencies**:
- `sys`, `os`: System interaction and environment variables
- `textwrap`: Help text formatting
- `gettext`: Optional internationalization support

**Architecture Notes**:
- Thread-unsafe due to parsing state stored in instance variables
- Extensible through subclassing Option and OptionParser classes
- Backward compatibility maintained for deprecated usage patterns
- Factory function `make_option` (L1681) provides future extensibility