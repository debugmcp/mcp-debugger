# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/argparse.py
@source-hash: de868aaccfaa38b3
@generated: 2026-02-09T18:07:47Z

## Purpose
Python's standard `argparse` module for parsing command-line arguments. This is a third-party distribution included with a LLDB Python environment for command-line interface functionality in debugging tools.

## Core Classes

### ArgumentParser (L1741-2672)
Main entry point for command-line parsing. Creates parser objects that handle optional and positional arguments.
- `__init__()` (L1763-1825): Configures parser with prog name, usage, description, formatters
- `add_argument()` (L1446-1495): Adds arguments to parser via `_ActionsContainer`
- `add_subparsers()` (L1843-1872): Creates subcommand parsers
- `parse_args()` (L1894-1902): Main parsing method, returns namespace
- `parse_known_args()` (L1904-1940): Parses known args, returns namespace + extras
- `_parse_known_args()` (L1942-2215): Core parsing logic with pattern matching
- `parse_intermixed_args()` (L2422-2430): Alternative parsing allowing intermixed positionals/optionals

### Action (L793-886) 
Base class for argument actions. Stores metadata about how to convert command-line strings to Python objects.
- Attributes: `option_strings`, `dest`, `nargs`, `const`, `default`, `type`, `choices`, `required`, `help`, `metavar`
- `__call__()` (L884-885): Abstract method for executing the action

### Action Subclasses
- `BooleanOptionalAction` (L891-946): Handles `--flag/--no-flag` patterns
- `_StoreAction` (L948-981): Default action that stores argument values
- `_StoreConstAction` (L983-1004): Stores constant values
- `_StoreTrueAction/_StoreFalseAction` (L1006-1038): Boolean flag actions
- `_AppendAction` (L1040-1076): Appends values to lists
- `_CountAction` (L1105-1126): Counts occurrences of flags
- `_HelpAction` (L1128-1145): Prints help and exits
- `_VersionAction` (L1147-1173): Prints version and exits
- `_SubParsersAction` (L1175-1275): Handles subcommand parsing
- `_ExtendAction` (L1276-1281): Extends lists with multiple values

### Help Formatting Classes
- `HelpFormatter` (L157-677): Base formatter for usage messages and argument help
- `RawDescriptionHelpFormatter` (L679-688): Preserves description formatting  
- `RawTextHelpFormatter` (L690-699): Preserves all help text formatting
- `ArgumentDefaultsHelpFormatter` (L701-727): Adds default values to help
- `MetavarTypeHelpFormatter` (L730-743): Uses type name as metavar

### Container Classes
- `_ActionsContainer` (L362-1670): Base class managing argument actions and groups
- `_ArgumentGroup` (L1671-1711): Groups related arguments in help display
- `_MutuallyExclusiveGroup` (L1713-1739): Enforces mutual exclusion between arguments

### Utility Classes
- `Namespace` (L1342-1360): Simple object for storing parsed argument values
- `FileType` (L1287-1337): Factory for creating file objects from filenames
- `_AttributeHolder` (L109-138): Base class providing `__repr__` functionality

## Key Constants
- Nargs patterns: `OPTIONAL` ('?'), `ZERO_OR_MORE` ('*'), `ONE_OR_MORE` ('+'), `PARSER` ('A...'), `REMAINDER` ('...')
- `SUPPRESS` (L96): Special value to suppress arguments in help/namespace

## Exception Classes
- `ArgumentError` (L764-782): Errors from creating/using arguments
- `ArgumentTypeError` (L784-786): Errors from type conversion

## Architecture Patterns
- Registry pattern in `_ActionsContainer` for action/type registration (L417-422)
- Template method pattern in help formatting hierarchy
- Command pattern with Action classes for argument processing
- Visitor pattern in parsing logic for handling different argument types

## Critical Parsing Flow
1. `parse_args()` → `parse_known_args()` → `_parse_known_args()`
2. Pattern matching on argument strings (O=optional, A=argument, -=separator)
3. Action resolution and execution via registered handlers
4. Namespace population and validation