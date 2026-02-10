# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/getopt.py
@source-hash: 0ce875700c879819
@generated: 2026-02-09T18:09:43Z

## Purpose
This module implements a command line option parser compatible with Unix getopt() conventions, supporting both short (`-x`) and long (`--option`) options with GNU-style flexibility.

## Key Classes & Functions

### GetoptError (L43-52)
Exception class for option parsing errors with `opt` and `msg` attributes. Provides backward compatibility via `error` alias (L54).

### getopt(args, shortopts, longopts) (L56-97)
Main parsing function using strict POSIX mode - stops at first non-option argument.
- Returns tuple: (option_pairs, remaining_args)
- Delegates to `do_shorts()` and `do_longs()` for processing
- Handles `--` separator to force end of options

### gnu_getopt(args, shortopts, longopts) (L99-147)
GNU-style parser allowing intermixed options and arguments.
- Respects `POSIXLY_CORRECT` environment variable (L125)
- Supports `+` prefix in shortopts for POSIX mode (L122-124)
- Collects non-options in `prog_args` during processing

### Internal Processing Functions

**do_longs(opts, opt, longopts, args) (L149-166)**
- Handles `--option[=value]` parsing
- Splits on `=` for inline arguments
- Uses `long_has_args()` for validation and matching

**long_has_args(opt, longopts) (L171-190)**
- Performs prefix matching for long options
- Handles ambiguous prefixes with error reporting
- Returns (has_arg_flag, resolved_option_name)

**do_shorts(opts, optstring, shortopts, args) (L192-205)**
- Processes clusters like `-abc`
- Uses `short_has_arg()` for argument requirements

**short_has_arg(opt, shortopts) (L207-211)**
- Checks if option requires argument by looking for trailing `:`

## Key Patterns
- **Option String Format**: Short options followed by `:` require arguments; long options followed by `=` require arguments
- **Prefix Matching**: Long options support unambiguous prefix matching
- **Error Handling**: All parsing errors raise GetoptError with specific option context
- **Internationalization**: Uses gettext with fallback for bootstrap scenarios (L37-41)

## Dependencies
- `os` module for environment variable access
- `gettext` for i18n (optional, with fallback)

## Critical Constraints
- Option parsing stops at `--` separator
- Empty string and single `-` are treated as non-options
- Argument clustering only supported for short options
- Long option prefix matching must be unambiguous