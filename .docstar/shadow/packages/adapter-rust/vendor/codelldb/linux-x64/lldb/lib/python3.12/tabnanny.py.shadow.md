# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/tabnanny.py
@source-hash: 5dae83b384db40d6
@generated: 2026-02-09T18:10:13Z

## Purpose
Python indentation ambiguity detector that identifies mixed space/tab usage that could cause semantic differences across different tab size interpretations. Primarily designed as a command-line script but exportable as a module.

## Key Components

### Main Entry Points
- `main()` (L40-56): CLI entry point handling `-q` (quiet) and `-v` (verbose) flags, processes file/directory arguments
- `check(file)` (L72-135): Core public API function that recursively processes directories or individual Python files

### Exception Handling
- `NannyNag` (L58-70): Custom exception raised when ambiguous indentation is detected, carries line number, message, and offending line content
- `errprint()` (L32-38): Error reporter that writes to stderr and exits with code 1

### Token Processing
- `process_tokens(tokens)` (L278-282): Public wrapper that catches `TabError` and converts to `NannyNag`
- `_process_tokens(tokens)` (L284-336): Core algorithm that tracks indentation stack and validates consistency using tokenizer output

### Whitespace Analysis Engine
- `Whitespace` class (L137-255): Sophisticated indentation analyzer that:
  - Parses mixed space/tab patterns into normalized form (L160-181)
  - Calculates effective indent levels for different tab sizes (L189-208) 
  - Compares indentation equivalence across tab interpretations (L212-228, L243-268)
  - Identifies problematic tab size witnesses (L219-228, L260-269)

### Key Algorithms
- Indentation stack management: Tracks nested indentation levels and validates INDENT/DEDENT token consistency
- Cross-tabsize validation: Ensures indentation relationships hold across different tab size interpretations
- Whitespace normalization: Converts complex space/tab patterns to canonical tuples for comparison

### Dependencies
- `tokenize`: Python source tokenization 
- `os`, `sys`: File system operations and CLI handling
- `getopt`: Command-line option parsing

### Global Configuration
- `verbose` (L29): Controls diagnostic output verbosity
- `filename_only` (L30): When set, only prints filenames of problematic files
- `__all__` (L27): Exports `check`, `NannyNag`, `process_tokens` for module usage

### Architectural Pattern
Follows a tokenizer-driven state machine approach where indentation consistency is validated by maintaining a stack of `Whitespace` objects and comparing them using mathematical indent level calculations across multiple theoretical tab sizes.