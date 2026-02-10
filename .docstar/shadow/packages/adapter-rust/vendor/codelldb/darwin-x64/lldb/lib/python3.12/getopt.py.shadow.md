# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/getopt.py
@source-hash: 0ce875700c879819
@generated: 2026-02-09T18:09:24Z

**Primary Purpose:** Standard Python command-line argument parsing module that mimics Unix getopt() functionality, supporting both short (-x) and long (--option) style options with GNU-style intermixed argument processing.

**Key Classes & Functions:**

- `GetoptError` (L43-52): Exception class with `opt` and `msg` attributes for option parsing errors
- `error` (L54): Backward compatibility alias for GetoptError
- `getopt(args, shortopts, longopts=[])` (L56-97): Core parsing function that processes options in order, stops at first non-option argument
- `gnu_getopt(args, shortopts, longopts=[])` (L99-147): GNU-style parser allowing intermixed options and arguments, supports POSIXLY_CORRECT environment variable
- `do_longs(opts, opt, longopts, args)` (L149-166): Processes long options (--option), handles argument parsing and validation
- `long_has_args(opt, longopts)` (L171-190): Determines if long option requires argument, supports prefix matching
- `do_shorts(opts, optstring, shortopts, args)` (L192-205): Processes short options (-x), handles option clustering
- `short_has_arg(opt, shortopts)` (L207-211): Checks if short option requires argument by examining colon placement

**Architecture & Patterns:**

- **Two-phase parsing:** Main functions delegate to specialized `do_longs`/`do_shorts` processors
- **Prefix matching:** Long options support partial matching if unambiguous (L176-190)
- **Option clustering:** Short options can be combined (-abc equivalent to -a -b -c)
- **Argument handling:** Colons in shortopts and equals in longopts indicate required arguments
- **GNU compatibility:** Supports POSIXLY_CORRECT and '+' prefix for strict POSIX behavior

**Dependencies:**
- `os` module for environment variable access (L36, L125)
- `gettext` for internationalization with fallback (L37-41)

**Key Invariants:**
- Options are returned as (option, value) tuples with option prefixes intact
- Empty string used for options without arguments
- Parsing stops at '--' separator
- Single '-' treated as non-option argument
- Longopts list normalized to handle string input (L84-87, L116-119)

**Return Format:** Both main functions return `(opts, remaining_args)` where opts contains parsed options and remaining_args contains unparsed arguments.