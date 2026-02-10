# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/getopt.py
@source-hash: 0ce875700c879819
@generated: 2026-02-09T18:07:04Z

## Primary Purpose
Standard Python library module implementing Unix-style command line option parsing with support for both short (`-a`) and long (`--alpha`) options. Provides both POSIX-compliant and GNU-style argument processing modes.

## Key Components

### Exception Classes
- **GetoptError (L43-52)**: Primary exception class with `opt` and `msg` attributes for option-specific error reporting
- **error (L54)**: Backward compatibility alias for GetoptError

### Core Parsing Functions
- **getopt(args, shortopts, longopts=[]) (L56-97)**: Main POSIX-style parser that stops at first non-option argument
  - Returns tuple of (option_list, remaining_args)  
  - Handles both `-x` short options and `--long` options
  - Supports option arguments via `:` (short) and `=` (long) syntax

- **gnu_getopt(args, shortopts, longopts=[]) (L99-147)**: GNU-style parser allowing intermixed options and arguments
  - Supports POSIXLY_CORRECT environment variable (L125)
  - Handles `+` prefix for POSIX mode (L122-124)
  - Accumulates non-option arguments in prog_args list

### Helper Functions
- **do_longs(opts, opt, longopts, args) (L149-166)**: Processes long options, handles argument extraction and validation
- **long_has_args(opt, longopts) (L171-190)**: Determines if long option requires argument, supports prefix matching with uniqueness validation
- **do_shorts(opts, optstring, shortopts, args) (L192-205)**: Processes clustered short options (e.g., `-abc`)
- **short_has_arg(opt, shortopts) (L207-211)**: Checks if short option requires argument by scanning for trailing `:`

## Key Dependencies
- **os**: Environment variable access for POSIXLY_CORRECT
- **gettext**: Internationalization support with fallback mechanism (L37-41)

## Architectural Patterns
- State machine approach: Different handlers for short/long options and argument states
- Prefix matching for long options with ambiguity resolution
- Lazy argument consumption: Options consume following arguments only when required
- Error context preservation: Exception includes the problematic option for debugging

## Critical Invariants
- Option arguments are always strings (empty string if no argument)
- Long options always prefixed with `--` in output tuples
- Short options always prefixed with `-` in output tuples  
- Arguments list is consumed left-to-right with remaining slice returned
- GNU mode preserves non-option argument order in separate list