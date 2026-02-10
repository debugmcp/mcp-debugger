# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/tabnanny.py
@source-hash: 5dae83b384db40d6
@generated: 2026-02-09T18:08:22Z

## Python Indentation Consistency Checker (tabnanny)

**Primary Purpose**: Detects and reports ambiguous indentation in Python source files, specifically cases where tabs and spaces are mixed in ways that could lead to inconsistent interpretation depending on tab size settings.

### Core Components

**Main Entry Point**
- `main()` (L40-56): Command-line interface with `-v` (verbose) and `-q` (filename-only) flags. Processes file/directory arguments through `check()`.

**Primary Analysis Functions**
- `check(file)` (L72-135): Main analysis function that recursively processes directories or analyzes individual `.py` files. Handles file I/O and tokenization errors, catches `NannyNag` exceptions for indentation problems.
- `process_tokens(tokens)` (L278-282): Public wrapper that converts `TabError` to `NannyNag` exceptions.
- `_process_tokens(tokens)` (L284-336): Core token analysis engine that tracks indentation stack and validates indent/dedent consistency.

**Exception Handling**
- `NannyNag` (L58-70): Custom exception for ambiguous indentation with line number, message, and offending line content.

**Whitespace Analysis Engine**
- `Whitespace` class (L137-269): Sophisticated indentation analyzer that:
  - Parses whitespace into normalized form tracking space/tab patterns (L160-181)
  - Calculates indent levels for different tab sizes via `indent_level(tabsize)` (L189-208)
  - Compares indentation equivalence with `equal()` and `less()` methods (L212-254)
  - Generates diagnostic witnesses for indentation conflicts (L219-228, L260-269)

**Utility Functions**
- `errprint(*args)` (L32-38): Error output with sys.exit(1)
- `format_witnesses(w)` (L271-276): Formats tab size conflict evidence for error messages

### Key Architecture Patterns

**Indentation Stack Model**: Uses stack-based tracking (`indents` list) to validate proper nesting of indentation levels through INDENT/DEDENT token analysis.

**Normalization Strategy**: Converts mixed space/tab patterns into canonical form `(count_tuple, trailing_spaces)` enabling mathematical comparison across different tab size interpretations.

**Token-Based Analysis**: Leverages Python's `tokenize` module to process indentation tokens rather than raw string analysis, ensuring accurate parsing.

### Critical Invariants

- Indentation must be strictly increasing on INDENT tokens
- Indentation must match exactly when returning to previous levels  
- Mixed tabs/spaces are only problematic when they create ambiguity across different tab size settings

### Dependencies

- `tokenize`: Core Python tokenization for parsing indentation
- `os`, `sys`: File system operations and command-line interface
- `getopt`: Command-line argument parsing

**Module Exports**: `["check", "NannyNag", "process_tokens"]` (L27)