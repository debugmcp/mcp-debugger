# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/getopt.py
@source-hash: 0ce875700c879819
@generated: 2026-02-09T18:08:49Z

## Command Line Argument Parser Module

**Primary Purpose:** Python implementation of Unix getopt() functionality for parsing command-line options and arguments. Supports both POSIX-style short options (-a) and GNU-style long options (--alpha).

### Key Classes and Functions

**GetoptError (L43-54)**: Exception class for option parsing errors
- Attributes: `opt` (option name), `msg` (error message)
- Backward compatibility alias `error` (L54)

**getopt() (L56-97)**: Core parsing function for strict POSIX mode
- Args: `args` (argv list), `shortopts` (option string), `longopts` (list)
- Returns: tuple of (parsed_options, remaining_args)
- Stops parsing at first non-option argument
- Processes options sequentially until non-option found

**gnu_getopt() (L99-147)**: GNU-style parser allowing intermixed options/arguments
- Same signature as getopt() but different behavior
- Respects POSIXLY_CORRECT environment variable (L125)
- '+' prefix in shortopts forces POSIX mode (L122-124)
- Collects non-option args in prog_args, continues parsing

### Internal Processing Functions

**do_longs() (L149-166)**: Processes long options (--option)
- Handles argument parsing via '=' separator (L151-155)
- Delegates to long_has_args() for validation

**long_has_args() (L171-190)**: Validates long options and determines argument requirements
- Implements prefix matching for partial option names
- Ensures unique matches, raises errors for ambiguous prefixes (L181-184)
- Returns (has_argument_flag, full_option_name)

**do_shorts() (L192-205)**: Processes short options (-o)
- Handles option clustering (-abc = -a -b -c)
- Delegates to short_has_arg() for validation

**short_has_arg() (L207-211)**: Determines if short option requires argument
- Uses ':' in shortopts string as argument indicator

### Dependencies and Patterns

- **gettext**: Internationalization support with fallback (L37-41)
- **os**: Environment variable access for POSIXLY_CORRECT
- **Architectural Pattern**: State machine processing command line sequentially
- **Error Handling**: Consistent exception raising with option context

### Critical Invariants

1. Options beginning with '-' are processed; '--' terminates option parsing
2. Short options use ':' suffix in shortopts to indicate required arguments  
3. Long options use '=' suffix in longopts to indicate required arguments
4. GNU mode allows option/non-option intermixing unless POSIXLY_CORRECT set
5. All functions return (opts_list, remaining_args) tuple format

### Notable Implementation Details

- Supports partial matching for long options with uniqueness validation
- Handles edge cases: single '-', empty option strings, missing required arguments
- Maintains option order in output for multiple occurrences
- Test runner included in main block (L213-215)