# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/argparse.py
@source-hash: de868aaccfaa38b3
@generated: 2026-02-09T18:07:09Z

Python's argparse module for command-line argument parsing. This is the standard library implementation providing a complete argument parsing system with help generation, type conversion, and error handling.

## Core Classes

**ArgumentParser (L1741-2672)** - Main entry point for command-line parsing
- `__init__` accepts prog, usage, description, formatter_class, etc.
- `add_argument()` (L1446) - Core method to define command-line arguments
- `parse_args()` (L1894) - Parses sys.argv and returns namespace object
- `parse_known_args()` (L1904) - Parses known args, returns namespace and remaining args
- `parse_intermixed_args()` (L2422) - Allows positional/optional intermixing
- `format_help()`/`print_help()` (L2606/L2640) - Generate/print help messages
- `error()` (L2661) - Print error and exit

**Action (L793-886)** - Base class for argument actions
- Stores option_strings, dest, nargs, type, choices, required, help, metavar
- `__call__()` method processes parsed values (must be overridden)
- Subclasses: `_StoreAction`, `_StoreConstAction`, `_StoreTrueAction`, `_StoreFalseAction`, `_AppendAction`, `_CountAction`, `_HelpAction`, `_VersionAction`, `_SubParsersAction`, `_ExtendAction`

**BooleanOptionalAction (L891-946)** - Modern boolean flag handling
- Automatically creates `--flag` and `--no-flag` variants
- Warns about deprecated parameters (type, choices, metavar)

**Namespace (L1342-360)** - Simple container for parsed arguments
- Supports equality comparison and attribute access
- Used as return type from parse_args()

**FileType (L1287-1337)** - Factory for file argument types
- Handles special "-" for stdin/stdout
- Supports mode, encoding, errors parameters

## Help Formatting System

**HelpFormatter (L157-677)** - Base help message formatter
- Manages text width, indentation, section organization
- `_format_usage()` (L297) - Generates usage line
- `_format_action()` (L516) - Formats individual argument help
- Subclasses provide different formatting styles:
  - `RawDescriptionHelpFormatter` (L679) - Preserves description formatting
  - `RawTextHelpFormatter` (L690) - Preserves all help text formatting  
  - `ArgumentDefaultsHelpFormatter` (L701) - Adds default values to help
  - `MetavarTypeHelpFormatter` (L730) - Uses type names as metavars

## Container System

**_ActionsContainer (L1362-1669)** - Base class for argument containers
- `add_argument()` implementation shared by parser and groups
- Registry system for actions, types, conflict resolution
- `_get_positional_kwargs()`/`_get_optional_kwargs()` (L1571/L1586) - Process argument definitions

**_ArgumentGroup (L1671-1711)** - Groups related arguments in help
**_MutuallyExclusiveGroup (L1713-1739)** - Ensures only one argument from group is used

## Key Constants & Utilities

Constants (L96-103): `SUPPRESS`, `OPTIONAL` (?), `ZERO_OR_MORE` (*), `ONE_OR_MORE` (+), `PARSER`, `REMAINDER`

**_AttributeHolder (L109-138)** - Provides repr() functionality for argparse classes

**ArgumentError/ArgumentTypeError (L764-786)** - Exception types for argument validation errors

## Architecture Notes

- Uses registry pattern for extensible action/type systems
- Complex parsing algorithm handles optional/positional argument intermixing
- Extensive pattern matching for nargs handling (L2376-2416)
- Lazy imports for performance (textwrap, shutil, copy modules only imported when needed)
- Support for reading arguments from files via fromfile_prefix_chars
- Comprehensive conflict resolution system for overlapping option strings