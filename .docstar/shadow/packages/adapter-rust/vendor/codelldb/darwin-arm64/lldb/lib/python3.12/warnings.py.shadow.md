# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/warnings.py
@source-hash: adb02ef44e1e9bf9
@generated: 2026-02-09T18:07:32Z

## Python Warnings Subsystem Implementation

Core module implementing Python's warning system, providing warning formatting, filtering, and display functionality.

### Key Components

**Public Warning API:**
- `warn()` (L299-344): Main warning function with stacklevel and skip_file_prefixes support
- `warn_explicit()` (L345-414): Low-level warning with explicit location parameters
- `showwarning()` (L10-13): Hook for custom warning display, delegates to `_showwarnmsg_impl`
- `formatwarning()` (L15-18): Standard warning message formatter

**Filter Management:**
- `filterwarnings()` (L133-166): Insert regex-based warning filters with action/category/module matching
- `simplefilter()` (L168-182): Insert simple filters without regex patterns
- `resetwarnings()` (L198-201): Clear all active warning filters
- `_add_filter()` (L184-196): Internal filter list management with duplicate handling

**Warning Display Implementation:**
- `_showwarnmsg_impl()` (L20-33): Core warning output to file/stderr with OSError handling
- `_formatwarnmsg_impl()` (L35-94): Rich formatting with source line extraction and tracemalloc integration
- `_showwarnmsg()` (L99-115): Dispatcher that checks for user-replaced showwarning functions
- `_formatwarnmsg()` (L120-131): Dispatcher that checks for user-replaced formatwarning functions

**Data Structures:**
- `WarningMessage` class (L416-435): Container for warning details with standard attributes
- Global state variables: `filters`, `defaultaction`, `onceregistry` (L567-583)

**Context Manager:**
- `catch_warnings` class (L438-511): Context manager for temporary warning state modification with optional recording

**Command Line Processing:**
- `_processoptions()` (L208-213): Process -W command line options
- `_setoption()` (L216-241): Parse individual -W option strings
- `_getaction()` (L244-251): Validate and normalize warning actions
- `_getcategory()` (L254-272): Resolve warning category from string specification

**Stack Frame Analysis:**
- `_is_internal_frame()` (L283-285): Detect CPython internal frames
- `_next_external_frame()` (L288-295): Skip internal frames for accurate warning location
- `_is_internal_filename()` (L275-276): Check for importlib bootstrap files

**Specialized Functions:**
- `_deprecated()` (L516-532): Emit deprecation warnings with version checking
- `_warn_unawaited_coroutine()` (L536-555): Handle unawaited coroutine warnings with origin tracking

### Architecture Notes

The module uses a dual implementation strategy: attempts to import optimized C implementations from `_warnings` module (L567-571), falling back to pure Python implementations. Warning filters are stored as 5-tuples (action, message_regex, category, module_regex, lineno) and processed sequentially for each warning.

Module initialization (L587-597) processes command line options and sets default filters for various warning categories when C implementation is unavailable.