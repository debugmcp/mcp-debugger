# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/tabnanny.py
@source-hash: 5dae83b384db40d6
@generated: 2026-02-09T18:07:33Z

## Purpose and Responsibility
Python indentation checking tool that detects ambiguous whitespace usage (mixing tabs and spaces inconsistently). Part of Python standard library, designed to be run as a script or imported as a module for IDE integration.

## Key Components

### Main Entry Points
- `main()` (L40-56): CLI entry point with command-line parsing (-q for filename-only output, -v for verbose)
- `check(file)` (L72-135): Primary function that recursively processes files/directories, handles .py files only

### Core Processing
- `process_tokens(tokens)` (L278-282): Public wrapper that catches TabError and converts to NannyNag
- `_process_tokens(tokens)` (L284-336): Main tokenization analysis engine using tokenize module
  - Tracks indentation stack with Whitespace objects
  - Validates INDENT/DEDENT consistency
  - Raises NannyNag on ambiguous indentation

### Exception Handling
- `NannyNag(Exception)` (L58-70): Custom exception for indentation violations
  - Properties: lineno, msg, line with getter methods
  - Raised by process_tokens, caught by check()

### Whitespace Analysis Engine
- `Whitespace` class (L137-269): Core indentation representation and comparison
  - `__init__(ws)` (L160-181): Parses whitespace string into normalized form
  - `indent_level(tabsize)` (L189-208): Calculates effective indentation for given tab size
  - `equal(other)` (L212-213): Checks if two whitespace patterns are equivalent
  - `less(other)` (L243-254): Determines if one indentation is strictly less than another
  - `not_equal_witness(other)` (L219-228): Finds tab sizes where indentations differ
  - `not_less_witness(other)` (L260-269): Finds tab sizes where first >= second

### Utility Functions
- `errprint(*args)` (L32-38): Error output and sys.exit wrapper
- `format_witnesses(w)` (L271-276): Formats witness tab sizes for error messages

## Dependencies
- `tokenize`: For Python source code tokenization
- `os`: File system operations (directory traversal, path joining)
- `sys`: Command-line arguments and stderr output
- `getopt`: Command-line option parsing

## Key Algorithms
The Whitespace class implements sophisticated indentation comparison using normalized forms that represent tab/space patterns. The core insight is that ambiguous indentation occurs when two whitespace patterns produce different effective indentations depending on tab size interpretation.

## Global State
- `verbose`: Controls output verbosity level
- `filename_only`: Controls whether to show only filenames or full error details

## Architectural Decisions
- Uses tokenizer-based analysis rather than line-by-line parsing for robust handling
- Maintains indentation stack to track nested scope levels
- Separates whitespace representation from comparison logic for modularity
- Exception-based error propagation from token processing to file handling