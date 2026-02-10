# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/optparse.py
@source-hash: 07d224301cba312f
@generated: 2026-02-09T18:08:31Z

**Primary Purpose**: A legacy command-line option parsing library providing extensible option handling with support for multiple argument formats, help generation, and type validation.

**Core Architecture**:

The module implements a hierarchical option parsing system with these key components:

**Exception Hierarchy (L103-159)**:
- `OptParseError` (L103): Base exception class
- `OptionError` (L111): Invalid Option configuration  
- `OptionConflictError` (L127): Conflicting option strings
- `OptionValueError` (L132): Invalid command-line values
- `BadOptionError` (L138): Unknown options on command line
- `AmbiguousOptionError` (L148): Ambiguous option abbreviations

**Help Formatting System (L161-404)**:
- `HelpFormatter` (L161): Abstract base class for formatting help output with configurable indentation, width calculation, and text wrapping
- `IndentedHelpFormatter` (L368): Concrete formatter with indented section bodies (default)
- `TitledHelpFormatter` (L387): Formatter with underlined section headers

**Type Validation (L406-447)**:
- `_parse_num()` (L406): Handles hex (0x), binary (0b), octal (0), and decimal number parsing
- `check_builtin()` (L427): Validates built-in types (int, long, float, complex)
- `check_choice()` (L435): Validates choice constraints
- `NO_DEFAULT` (L446): Sentinel value distinguishing None from no default

**Core Option System**:

**Option Class (L449-817)**:
- Comprehensive option definition with action types: store, store_const, store_true/false, append, append_const, count, callback, help, version
- Validation methods (`_check_*` L632-739): Ensures option consistency during construction
- Type checking system (`TYPE_CHECKER` L543) with pluggable validators
- Action processing (`take_action()` L787): Dispatches to appropriate handling based on action type

**Value Container (L823-886)**:
- `Values` (L823): Stores parsed option values with dict-like interface
- Supports careful/loose update modes for configuration loading
- Module/file loading capabilities (`read_module()` L872, `read_file()` L877)

**Option Management**:

**OptionContainer (L888-1074)**:
- Abstract base for option collections with conflict resolution ("error" vs "resolve" modes)
- Maintains option mappings (`_short_opt`, `_long_opt`) and defaults
- Help formatting delegation to formatter instances

**OptionGroup (L1076-1104)**:
- Groups related options for organized help display
- Shares option mappings with parent parser

**Main Parser (L1106-1649)**:

**OptionParser (L1106)**:
- Central parsing engine with configurable behavior:
  - `allow_interspersed_args` (L1194): Controls argument order flexibility
  - `process_default_values` (L1195): Type-checks default values
- Parsing state management (`rargs`, `largs`, `values` L1257-1259)
- Two-phase parsing: `_process_long_opt()` (L1467) and `_process_short_opts()` (L1503)

**Key Processing Logic**:
- `parse_args()` (L1355): Main entry point returning (values, remaining_args)
- Long option matching with abbreviation support (`_match_long_opt()` L1458)
- Short option clustering (e.g., "-abc" = "-a -b -c")
- Value extraction handling explicit (--opt=val) and implicit (--opt val) forms

**Utility Functions**:
- `_match_abbrev()` (L1652): Unambiguous abbreviation matching with error handling
- `make_option` (L1681): Factory function alias for Option constructor

**Constants**:
- `SUPPRESS_HELP`/`SUPPRESS_USAGE` (L820-821): Control help text display
- Module exports via `__all__` (L26-42)

**Integration Notes**: Part of Python's standard library until deprecated in favor of argparse. Commonly found in legacy codebases and development tools. Thread-unsafe due to parsing state storage in parser instance.