# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/argparse.py
@source-hash: de868aaccfaa38b3
@generated: 2026-02-09T18:13:04Z

## Purpose
The Python standard library's `argparse` module providing command-line argument parsing functionality. This is a complete implementation distributed with LLDB debugger tools, offering comprehensive argument parsing capabilities for Python applications.

## Core Architecture
Built around several key components that work together to parse and validate command-line arguments:

### Primary Classes
- **ArgumentParser (L1741-2672)**: Main parser class that processes command-line strings into Python objects. Inherits from `_AttributeHolder` and `_ActionsContainer`. Key methods:
  - `parse_args()` (L1894): Parse arguments and return namespace
  - `parse_known_args()` (L1904): Parse known arguments, return unrecognized ones
  - `add_argument()` (L1446): Add argument definitions
  - `add_subparsers()` (L1843): Add subcommand support

- **Action (L793-885)**: Base class for all argument actions. Defines the interface for converting command-line strings to Python values. Key attributes include `option_strings`, `dest`, `nargs`, `type`, `choices`, `required`, `help`.

- **Namespace (L1342-1360)**: Simple container for parsed argument values, supporting attribute access and equality comparison.

### Formatter Classes
- **HelpFormatter (L157-677)**: Default help message formatter with complex text wrapping and layout logic
- **RawDescriptionHelpFormatter (L679-687)**: Preserves description formatting
- **RawTextHelpFormatter (L690-698)**: Preserves all help text formatting  
- **ArgumentDefaultsHelpFormatter (L701-726)**: Adds default values to help messages
- **MetavarTypeHelpFormatter (L730-742)**: Uses type name as metavar

### Action Implementations
Concrete action classes handling different argument behaviors:
- **_StoreAction (L948-981)**: Default action storing argument values
- **_StoreConstAction (L983-1003)**: Stores constant values
- **_StoreTrueAction/_StoreFalseAction (L1006-1037)**: Boolean flag actions
- **_AppendAction (L1040-1075)**: Accumulates multiple values in lists
- **_CountAction (L1105-1125)**: Counts option occurrences
- **_HelpAction (L1128-1144)**: Displays help and exits
- **_VersionAction (L1147-1172)**: Displays version and exits
- **_SubParsersAction (L1175-1275)**: Handles subcommand parsing
- **BooleanOptionalAction (L891-945)**: Modern boolean option with --flag/--no-flag

### Container Classes
- **_ActionsContainer (L1362-1669)**: Base class managing argument actions, groups, and conflict resolution
- **_ArgumentGroup (L1671-1710)**: Groups related arguments in help output
- **_MutuallyExclusiveGroup (L1713-1738)**: Ensures only one argument from group is used

### Type and Error Classes
- **FileType (L1287-1336)**: Factory for file object creation with mode/encoding support
- **ArgumentError (L764-781)**: Exception for argument-related errors
- **ArgumentTypeError (L784-786)**: Exception for type conversion errors

## Key Constants and Patterns
- **Nargs constants (L96-102)**: `OPTIONAL` ('?'), `ZERO_OR_MORE` ('*'), `ONE_OR_MORE` ('+'), `PARSER` ('A...'), `REMAINDER` ('...'), `SUPPRESS`
- **Action registry (L1380-1391)**: Maps string names to action classes
- **Prefix handling**: Supports customizable option prefixes (default '-')

## Critical Parsing Logic
The core parsing happens in `_parse_known_args()` (L1942-2215):
1. **Pattern matching**: Creates argument pattern string ('O' for options, 'A' for arguments, '-' for '--')
2. **Two-phase parsing**: Alternates between consuming optional arguments and positional arguments
3. **Conflict resolution**: Validates mutually exclusive groups and required arguments
4. **Type conversion**: Applies type functions and validates choices

## Complex Features
- **Subparsers**: Full support for subcommands with independent argument sets
- **Argument groups**: Visual organization and mutual exclusion logic  
- **File argument expansion**: Can read arguments from files using prefix chars
- **Abbreviation support**: Allows unambiguous long option abbreviations
- **Intermixed parsing**: `parse_intermixed_args()` allows flexible positional/optional mixing

## Utility Functions
- **_copy_items() (L140-149)**: Efficient copying for append actions
- **_get_action_name() (L749-761)**: Extracts display name from actions for error messages
- **_AttributeHolder (L109-137)**: Provides clean `__repr__` for configuration objects