# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/argparse.py
@source-hash: de868aaccfaa38b3
@generated: 2026-02-09T18:08:43Z

Python's standard library command-line argument parsing module, vendored within the LLDB debugger environment. Provides comprehensive CLI parsing capabilities with support for positional arguments, optional arguments, subcommands, and help generation.

## Core Components

**ArgumentParser (L1741-2672)** - Main entry point for command-line parsing. Configurable with various options including program name, usage messages, help formatting, and error handling. Key methods:
- `add_argument()` (L1446-1495) - Register command-line arguments  
- `parse_args()` (L1894-1902) - Parse arguments and return namespace
- `parse_known_args()` (L1904-1940) - Parse known arguments, return extras
- `parse_intermixed_args()` (L2422-2430) - Allow intermixed positional/optional args

**Action Classes (L793-1282)** - Define argument behavior:
- `Action` (L793-886) - Base class for all argument actions
- `BooleanOptionalAction` (L891-946) - Boolean flags with --no- variants
- `_StoreAction` (L948-981) - Store argument value (default behavior)
- `_StoreConstAction` (L983-1003) - Store constant value
- `_StoreTrueAction`/`_StoreFalseAction` (L1006-1037) - Boolean flags
- `_AppendAction` (L1040-1075) - Append values to list
- `_CountAction` (L1105-1125) - Count occurrences
- `_HelpAction` (L1128-1144) - Print help and exit
- `_VersionAction` (L1147-1172) - Print version and exit
- `_SubParsersAction` (L1175-1275) - Handle subcommands
- `_ExtendAction` (L1276-1281) - Extend list with multiple values

**Help Formatting System (L157-743)**:
- `HelpFormatter` (L157-677) - Base formatter for usage/help messages
- `RawDescriptionHelpFormatter` (L679-687) - Preserves description formatting
- `RawTextHelpFormatter` (L690-698) - Preserves all text formatting  
- `ArgumentDefaultsHelpFormatter` (L701-727) - Adds default values to help
- `MetavarTypeHelpFormatter` (L730-742) - Uses type names as metavars

**Container Classes**:
- `_ActionsContainer` (L1362-1669) - Base class for argument containers, handles registration and conflict resolution
- `_ArgumentGroup` (L1671-1710) - Groups related arguments in help output
- `_MutuallyExclusiveGroup` (L1713-1738) - Enforces mutual exclusion between arguments

**Supporting Types**:
- `Namespace` (L1342-1360) - Simple attribute container for parsed arguments
- `FileType` (L1287-1336) - Factory for file-like argument types
- `ArgumentError` (L764-782) - Exception for argument-related errors
- `ArgumentTypeError` (L784-786) - Exception for type conversion errors

## Key Constants (L96-103)
- `SUPPRESS` - Suppress argument in output
- `OPTIONAL` ('?') - Zero or one argument
- `ZERO_OR_MORE` ('*') - Zero or more arguments  
- `ONE_OR_MORE` ('+') - One or more arguments
- `PARSER` ('A...') - Subparser arguments
- `REMAINDER` ('...') - Remaining arguments

## Utilities
- `_AttributeHolder` (L109-138) - Provides consistent `__repr__` for classes
- `_copy_items()` (L140-149) - Safely copy argument lists
- `_get_action_name()` (L749-761) - Extract displayable action name

The module supports complex argument patterns including subcommands, mutually exclusive groups, file input, argument abbreviation, and comprehensive help generation. All parsing is performed through regex pattern matching of argument strings.