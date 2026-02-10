# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/tabnanny.py
@source-hash: 5dae83b384db40d6
@generated: 2026-02-09T18:09:23Z

## Primary Purpose
Python indentation validator that detects ambiguous whitespace usage (mixing tabs/spaces). Designed as both a standalone script and importable module for IDE integration.

## Core Components

### Exception Classes
- **NannyNag (L58-70)**: Custom exception raised when ambiguous indentation is detected. Stores line number, message, and problematic line content. Provides getter methods for accessing violation details.

### Main Functions  
- **main() (L40-56)**: CLI entry point handling command-line arguments (`-q` for filename-only output, `-v` for verbose). Processes file/directory arguments through `check()`.
- **check(file) (L72-135)**: Core validation function that recursively processes directories or individual `.py` files. Opens files using `tokenize.open()`, processes tokens via `process_tokens()`, and handles various exceptions (TokenError, IndentationError, SyntaxError, NannyNag).
- **process_tokens(tokens) (L278-282)**: Public wrapper that catches `TabError` and converts to `NannyNag`.
- **_process_tokens(tokens) (L284-336)**: Core token processing logic maintaining indentation stack and validating consistency.

### Whitespace Analysis Engine
- **Whitespace class (L137-269)**: Sophisticated whitespace representation and comparison system
  - `__init__` (L160-181): Parses whitespace string into normalized form with counts and trailing spaces
  - `indent_level(tabsize) (L189-208)`: Calculates effective indentation level for given tab size
  - `equal(other) (L212-213)`: Tests if two whitespace patterns are equivalent across all tab sizes
  - `less(other) (L243-254)`: Tests if this indentation is consistently less than other across all tab sizes
  - `not_equal_witness(other) (L219-228)`: Returns tab sizes where indentations differ (for error reporting)
  - `not_less_witness(other) (L260-269)`: Returns tab sizes where indentation comparison fails

### Token Processing Algorithm
The `_process_tokens()` function implements a state machine:
- Maintains `indents` stack of `Whitespace` objects representing nesting levels
- Uses `check_equal` flag to track when indentation consistency should be verified
- On `NEWLINE`: Sets flag to check next statement's indentation
- On `INDENT`: Validates new level is strictly greater than current, pushes to stack
- On `DEDENT`: Pops from stack, prepares for consistency check
- On program statements: Validates indentation matches current stack top

## Key Dependencies
- `tokenize`: For Python source code tokenization and file handling
- `os`: File system operations for directory traversal  
- `sys`: Command-line arguments and stderr output
- `getopt`: Command-line option parsing

## Global State
- `verbose` (L29): Controls output verbosity level
- `filename_only` (L30): Controls output format (filenames vs. full details)

## Output Behavior
- Verbose mode: Detailed problem descriptions with line numbers and context
- Quiet mode: Just problematic filenames
- Normal mode: Filename, line number, and problematic line content

## Critical Algorithms
The whitespace comparison logic uses mathematical analysis to determine if two indentation patterns are equivalent or consistently ordered across all possible tab size interpretations, enabling detection of subtle ambiguities that could cause inconsistent behavior across different editors/tools.