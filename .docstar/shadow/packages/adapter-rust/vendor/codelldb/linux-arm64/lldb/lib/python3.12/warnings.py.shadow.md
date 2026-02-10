# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/warnings.py
@source-hash: adb02ef44e1e9bf9
@generated: 2026-02-09T18:09:29Z

## Purpose & Responsibility

Core Python warnings subsystem implementation that handles warning formatting, filtering, and display. Acts as the Python-level interface to the C `_warnings` module, with fallback pure Python implementations when the C module is unavailable.

## Key Components

### Core Warning Functions
- **`warn(message, category=None, stacklevel=1, source=None, *, skip_file_prefixes=())` (L299-343)**: Main warning entry point with stack frame analysis and filtering
- **`warn_explicit(message, category, filename, lineno, module=None, registry=None, module_globals=None, source=None)` (L345-413)**: Low-level warning issuance with explicit location details
- **`showwarning(message, category, filename, lineno, file=None, line=None)` (L10-13)**: Default warning display hook (user-replaceable)
- **`formatwarning(message, category, filename, lineno, line=None)` (L15-18)**: Standard warning formatting function

### Internal Implementation
- **`_showwarnmsg_impl(msg)` (L20-33)**: Core message display with stderr fallback handling
- **`_formatwarnmsg_impl(msg)` (L35-94)**: Rich formatting including source line extraction and tracemalloc integration
- **`_showwarnmsg(msg)` (L99-115)** & **`_formatwarnmsg(msg)` (L120-131)**: Hook wrappers that detect and delegate to user replacements

### Filter Management
- **`filterwarnings(action, message="", category=Warning, module="", lineno=0, append=False)` (L133-166)**: Add regex-based warning filters with action specification
- **`simplefilter(action, category=Warning, lineno=0, append=False)` (L168-182)**: Add simple category-based filters
- **`_add_filter(*item, append)` (L184-196)**: Internal filter list manipulation
- **`resetwarnings()` (L198-201)**: Clear all active filters

### Command Line Processing
- **`_processoptions(args)` (L208-213)**: Process -W command line options
- **`_setoption(arg)` (L216-241)**: Parse individual -W option string
- **`_getaction(action)` (L244-251)** & **`_getcategory(category)` (L254-272)**: Helper parsers for action/category strings

### Stack Frame Analysis
- **`_is_internal_filename(filename)` (L275-276)**: Detect CPython internal files
- **`_is_filename_to_skip(filename, skip_file_prefixes)` (L279-280)**: Check user-specified file prefixes to skip
- **`_next_external_frame(frame, skip_file_prefixes)` (L288-295)**: Walk stack to find next non-internal frame

### Data Classes
- **`WarningMessage` (L416-435)**: Structured warning data container with all context fields
- **`catch_warnings` (L438-511)**: Context manager for temporary warning filter/display changes with optional recording

### Utilities
- **`_deprecated(name, message=_DEPRECATED_MSG, *, remove, _version=sys.version_info)` (L516-532)**: Standard deprecation warning helper
- **`_warn_unawaited_coroutine(coro)` (L536-555)**: Specialized coroutine warning with origin tracking

## Critical Architecture

### Module State Management
- **Global filter list**: `filters` (L567/573) - 5-tuples of (action, message_regex, category, module_regex, lineno)
- **Registry versioning**: `_filters_version` (L577) with `_filters_mutated()` (L579-581) for cache invalidation
- **Default action fallback**: `defaultaction` (L569/574)
- **Once-only registry**: `onceregistry` (L570/575) for "once" action tracking

### C Module Integration
Attempts to import optimized implementations from `_warnings` C extension (L567-571), falls back to pure Python (L572-583).

### Filter Processing Logic
- Filters are tuples: `(action, compiled_message_regex, category_class, compiled_module_regex, line_number)`
- Actions: "error", "ignore", "always", "default", "module", "once"
- Registry keys: `(text, category, lineno)` for per-location tracking

## Dependencies
- **sys**: Core Python system interface
- **re**: Regex compilation for message/module filtering (imported conditionally)
- **linecache**: Source line extraction for display
- **tracemalloc**: Memory allocation tracing (optional)
- **builtins**: Built-in warning categories lookup