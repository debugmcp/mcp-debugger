# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/getopt.py
@source-hash: 0ce875700c879819
@generated: 2026-02-09T18:13:18Z

## Primary Purpose
Command line argument parsing module providing Unix getopt() compatibility for Python scripts. Implements both standard getopt behavior and GNU-style parsing where options and non-options can be intermixed.

## Core API Functions

**getopt() (L56-97)**: Standard command line parser that stops processing options when first non-option argument is encountered. Returns tuple of (options_list, remaining_args).
- Parameters: args (argv slice), shortopts (option string), longopts (optional list)
- Short options follow Unix convention (`:` indicates required argument)
- Long options use `=` suffix for required arguments

**gnu_getopt() (L99-147)**: Extended parser allowing intermixed options and arguments. Respects POSIXLY_CORRECT environment variable and `+` prefix in shortopts for strict POSIX behavior.

## Exception Handling

**GetoptError (L43-52)**: Primary exception class with `opt` and `msg` attributes. Raised for unrecognized options, missing required arguments, or unexpected arguments.

**error (L54)**: Backward compatibility alias for GetoptError.

## Internal Processing Functions

**do_longs() (L149-166)**: Processes long options (--option format), handles argument parsing and validation. Supports both `--opt=value` and `--opt value` formats.

**long_has_args() (L171-190)**: Determines if long option requires argument and resolves partial matches. Implements unique prefix matching for abbreviated long options.

**do_shorts() (L192-205)**: Processes short options (-o format), handles option clustering (-abc equivalent to -a -b -c).

**short_has_arg() (L207-211)**: Checks if short option requires argument by examining position in shortopts string.

## Key Architectural Decisions

- Maintains strict Unix getopt() compatibility in standard mode
- Supports GNU extensions via separate function rather than mode flags  
- Uses exception-based error handling rather than return codes
- Implements partial matching for long options (unique prefix resolution)
- Handles internationalization via gettext with graceful fallback (L37-41)

## Critical Constraints

- Option parsing stops at `--` separator in both modes
- Single `-` is treated as non-option argument (typically stdin indicator)
- Long options must be unique when abbreviated
- Short option clustering requires options without arguments to come first
- POSIXLY_CORRECT environment variable overrides default GNU behavior