# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/argparse.py
@source-hash: de868aaccfaa38b3
@generated: 2026-02-09T18:09:41Z

## Primary Purpose
Python's standard library argparse module for command-line argument parsing. Provides a complete framework for converting command-line strings into Python objects with support for optional/positional arguments, subparsers, and help generation.

## Key Classes and Architecture

### Core Parser Class
- **ArgumentParser (L1741-2672)**: Main entry point for command-line parsing. Inherits from `_AttributeHolder` and `_ActionsContainer`. Key methods:
  - `parse_args()` (L1894-1902): Primary parsing method
  - `parse_known_args()` (L1904-1940): Parsing with unrecognized args support
  - `add_argument()` (inherited from `_ActionsContainer`): Add arguments to parser
  - `add_subparsers()` (L1843-1872): Support for subcommands

### Action System
- **Action (L793-886)**: Base class for all argument actions. Defines interface with `__call__()` method
- **Built-in Actions**:
  - `_StoreAction` (L948-981): Default action, stores argument value
  - `_StoreConstAction` (L983-1004): Stores constant value
  - `_StoreTrueAction`/`_StoreFalseAction` (L1006-1038): Boolean flags
  - `_AppendAction` (L1040-1076): Accumulates values in list
  - `_CountAction` (L1105-1126): Counts occurrences
  - `_HelpAction` (L1128-1145): Prints help and exits
  - `_VersionAction` (L1147-1173): Prints version and exits
  - `_SubParsersAction` (L1175-1275): Handles subcommand dispatch
  - `BooleanOptionalAction` (L891-946): Boolean with --no- negation support

### Container System
- **_ActionsContainer (L1362-1669)**: Base class providing argument addition/management
- **_ArgumentGroup (L1671-1711)**: Groups related arguments in help
- **_MutuallyExclusiveGroup (L1713-1739)**: Enforces mutual exclusivity

### Help Formatting
- **HelpFormatter (L157-677)**: Default help formatter with automatic text wrapping
- **Specialized Formatters**:
  - `RawDescriptionHelpFormatter` (L679-688): Preserves description formatting
  - `RawTextHelpFormatter` (L690-699): Preserves all text formatting
  - `ArgumentDefaultsHelpFormatter` (L701-727): Adds default values to help
  - `MetavarTypeHelpFormatter` (L730-743): Uses type as metavar

### Support Classes
- **Namespace (L1342-1360)**: Simple object for storing parsed arguments
- **FileType (L1287-1337)**: Factory for file object creation
- **Exception Classes**:
  - `ArgumentError` (L764-782): Argument-specific errors
  - `ArgumentTypeError` (L784-787): Type conversion errors

## Key Constants and Utilities
- **Argument quantity specifiers** (L96-102): `OPTIONAL` ('?'), `ZERO_OR_MORE` ('*'), `ONE_OR_MORE` ('+'), etc.
- **_copy_items() (L140-149)**: Lazy-loading copy utility for append actions
- **_get_action_name() (L749-762)**: Extracts displayable name from actions

## Critical Parsing Logic
- **_parse_known_args() (L1942-2215)**: Core parsing algorithm handling:
  - Option/positional identification and pattern matching
  - Mutual exclusivity checking  
  - Required argument validation
  - Subparser delegation
- **_match_argument() (L2247-2267)**: Pattern matching for argument consumption
- **_get_values() (L2509-2558)**: Value conversion and validation

## Architecture Patterns
- **Registry pattern**: Actions and types registered by string keys
- **Template method**: Extensible parsing through overridable methods
- **Composite pattern**: Argument groups contain actions
- **Strategy pattern**: Pluggable help formatters and conflict handlers

## Dependencies
- Standard library only: `os`, `re`, `sys`, `warnings`, `gettext`, `textwrap`, `shutil`
- Lazy imports for performance (textwrap, copy, shutil)

## Notable Design Decisions
- Inheritance-based extensibility for parsers, actions, and formatters
- Namespace objects for parsed results rather than dictionaries
- Support for reading arguments from files via prefix characters
- Comprehensive error handling with localized messages