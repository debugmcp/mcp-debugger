# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/warnings.py
@source-hash: adb02ef44e1e9bf9
@generated: 2026-02-09T18:08:23Z

## Primary Purpose
Core implementation of Python's warnings subsystem providing warning display, filtering, and formatting capabilities. This is part of the LLDB debugger's embedded Python environment for the CodeLLDB Rust adapter.

## Key Components

### Public API Functions
- `warn(message, category, stacklevel, source, skip_file_prefixes)` (L299-343): Main warning issuance function with stack level control and frame skipping
- `warn_explicit(message, category, filename, lineno, module, registry, module_globals, source)` (L345-413): Direct warning emission with explicit location details
- `showwarning(message, category, filename, lineno, file, line)` (L10-13): Hook for custom warning display
- `formatwarning(message, category, filename, lineno, line)` (L15-18): Standard warning formatting function
- `filterwarnings(action, message, category, module, lineno, append)` (L133-166): Add regex-based warning filters
- `simplefilter(action, category, lineno, append)` (L168-182): Add simple category-based filters
- `resetwarnings()` (L198-201): Clear all warning filters

### Core Classes
- `WarningMessage` (L416-435): Data container for warning details with attributes message, category, filename, lineno, file, line, source
- `catch_warnings` (L438-511): Context manager for temporarily modifying warning behavior, supports recording warnings to list
- `_OptionError` (L203-205): Exception for invalid warning option processing

### Implementation Details
- `_showwarnmsg_impl(msg)` (L20-33): Core warning display logic with stderr fallback
- `_formatwarnmsg_impl(msg)` (L35-94): Detailed warning formatting with source line lookup and tracemalloc integration
- `_showwarnmsg(msg)` (L99-115): Dispatcher that checks for replaced showwarning function
- `_formatwarnmsg(msg)` (L120-131): Dispatcher that checks for replaced formatwarning function

### Command-Line Processing
- `_processoptions(args)` (L208-213): Process -W command line options
- `_setoption(arg)` (L216-241): Parse individual warning option strings
- `_getaction(action)` (L244-251): Validate and normalize action names
- `_getcategory(category)` (L254-272): Resolve category strings to Warning classes

### Frame Navigation
- `_is_internal_filename(filename)` (L275-276): Detect Python internal files
- `_is_filename_to_skip(filename, skip_file_prefixes)` (L279-280): Check against skip prefixes
- `_is_internal_frame(frame)` (L283-285): Identify internal Python frames
- `_next_external_frame(frame, skip_file_prefixes)` (L288-295): Navigate to next user code frame

### Utility Functions
- `_deprecated(name, message, remove, _version)` (L516-532): Issue deprecation warnings with version checks
- `_warn_unawaited_coroutine(coro)` (L536-555): Special warning for unawaited coroutines with origin tracking

### Module State Management
Global variables managed through C extension or fallback:
- `filters`: List of 5-tuples (action, message_regex, category, module_regex, lineno)
- `defaultaction`: Default action for unmatched warnings
- `onceregistry`: Registry for "once" action warnings
- `_filters_version`: Version counter for filter list changes

### Initialization (L586-597)
Processes sys.warnoptions and sets up default filters for various warning categories in non-debug builds, with special handling for DeprecationWarning, PendingDeprecationWarning, ImportWarning, and ResourceWarning.

## Architectural Patterns
- **Dual Implementation**: Attempts to import from C extension `_warnings`, falls back to pure Python
- **Hook System**: Functions can be replaced via module attributes with original reference preservation
- **Filter Chain**: Sequential filter matching with first-match-wins semantics
- **Registry Pattern**: Per-module warning registries prevent duplicate warnings
- **Context Management**: Temporary warning behavior modification through context managers