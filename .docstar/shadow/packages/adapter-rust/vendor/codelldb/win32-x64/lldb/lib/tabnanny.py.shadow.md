# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/tabnanny.py
@source-hash: 5dae83b384db40d6
@generated: 2026-02-09T18:13:22Z

## Purpose
Python indentation analysis tool that detects ambiguous whitespace usage in Python source files. Warns when mixing tabs and spaces could cause interpretation differences across different tab size settings.

## Core Components

### Main Entry Points
- `main()` (L40-56): CLI entry point handling -q (quiet) and -v (verbose) flags, processes file/directory arguments
- `check(file)` (L72-135): Primary analysis function, recursively processes directories or individual .py files

### Exception Handling
- `NannyNag` (L58-70): Custom exception for indentation violations, stores line number, message, and problematic line content
- Accessor methods: `get_lineno()`, `get_msg()`, `get_line()`

### Token Processing
- `process_tokens(tokens)` (L278-282): Wrapper that converts `TabError` to `NannyNag`
- `_process_tokens(tokens)` (L284-336): Core tokenization logic tracking indentation stack
  - Monitors INDENT/DEDENT/NEWLINE tokens
  - Validates indentation consistency using `Whitespace` objects
  - Raises `NannyNag` for violations

### Whitespace Analysis Engine
- `Whitespace` class (L137-269): Sophisticated whitespace pattern analyzer
  - `__init__(ws)` (L160-181): Parses whitespace string into normalized form
  - `indent_level(tabsize)` (L189-208): Calculates effective indentation for given tab size
  - `equal(other)` (L212-213): Checks if two whitespace patterns are equivalent across all tab sizes
  - `less(other)` (L243-254): Determines strict indentation ordering
  - `not_equal_witness(other)` (L219-228): Finds tab sizes where patterns differ
  - `not_less_witness(other)` (L260-269): Finds tab sizes proving non-ordering

### Utilities
- `errprint(*args)` (L32-38): Error output with sys.exit(1)
- `format_witnesses(w)` (L271-276): Formats tab size evidence for error messages

## Key Data Structures
- `indents` stack: Tracks nested indentation levels as `Whitespace` objects
- Whitespace normalization: `(count_tuple, trailing_spaces)` representing tab/space patterns
- Token types tracked: INDENT, DEDENT, NEWLINE, COMMENT, NL

## Algorithm
1. Tokenize Python source using `tokenize` module
2. Track indentation changes via INDENT/DEDENT tokens
3. For each indentation level, create `Whitespace` object analyzing tab/space mixture
4. Verify new indentations are strictly greater than previous level
5. Verify dedented lines match exactly with corresponding stack level
6. Report violations with specific tab sizes where ambiguity occurs

## Dependencies
- `tokenize`: Python source tokenization
- `os`, `sys`: File system operations and system interface
- `getopt`: Command line argument parsing