# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/warnings.py
@source-hash: adb02ef44e1e9bf9
@generated: 2026-02-09T18:10:21Z

**Primary Purpose**: Python's warnings subsystem implementation, providing warning filtering, formatting, and display capabilities. This is the Python-level implementation that can be overridden by the C `_warnings` module for performance.

**Core Architecture**:
- **Filter-based system**: Warnings are processed through a configurable filter chain that determines actions (ignore, error, show, etc.)
- **Dual implementation strategy**: Falls back to pure Python if C module unavailable (L566-584)
- **Context management**: Provides `catch_warnings` for temporary warning state changes

**Key Classes**:

**WarningMessage (L416-435)**: Data container for warning information
- Stores message, category, filename, lineno, file, line, source
- Used internally to pass warning data between functions
- `_WARNING_DETAILS` defines canonical attribute names

**catch_warnings (L438-511)**: Context manager for warning control
- `record=True`: Captures warnings to list instead of displaying
- `module`: Allows testing with alternative warning modules  
- `action`: Auto-applies filter on entry
- Preserves/restores warning state on entry/exit

**Core Functions**:

**warn (L299-343)**: Main warning entry point
- Handles stacklevel navigation and frame introspection
- Supports `skip_file_prefixes` for hiding internal frames
- Delegates to `warn_explicit` with context information

**warn_explicit (L345-413)**: Core warning processing engine
- Applies filter chain to determine action (ignore/error/show/once/module/always)
- Manages per-module warning registries for deduplication
- Creates and displays WarningMessage objects

**showwarning/formatwarning (L10-18)**: Display interface
- Public hooks for customizing warning output
- Delegate to internal `_showwarnmsg_impl/_formatwarnmsg_impl`
- Support replacement detection via `_showwarning_orig/_formatwarning_orig`

**Filter Management**:
- **filterwarnings (L133-166)**: Add regex-based filters with full control
- **simplefilter (L168-182)**: Add simple category-based filters
- **resetwarnings (L198-201)**: Clear all filters
- **_add_filter (L184-196)**: Internal filter list management

**Display Implementation**:
- **_showwarnmsg_impl (L20-33)**: Write warning to file (default stderr)
- **_formatwarnmsg_impl (L35-94)**: Format warning text with source line and tracemalloc info

**Command-line Processing**:
- **_processoptions (L208-213)**: Process `-W` command-line options
- **_setoption (L216-241)**: Parse individual warning option strings
- **_getaction/_getcategory (L244-272)**: Convert string specs to objects

**Frame Navigation** (L275-296):
- **_is_internal_frame**: Detect CPython implementation frames
- **_next_external_frame**: Skip internal/user-specified frames  
- **_is_filename_to_skip**: Check against skip prefixes

**Specialized Functions**:
- **_deprecated (L516-532)**: Standard deprecation warning with version checking
- **_warn_unawaited_coroutine (L536-555)**: Coroutine-specific warning formatting

**Global State** (L566-597):
- `filters`: Filter list (from C module or empty list)
- `defaultaction`: Default action when no filters match
- `onceregistry`: Cross-module deduplication for "once" action
- `_filters_version`: Cache invalidation for filter changes

**Dependencies**: 
- `sys`: Frame introspection, stderr access, warnoptions
- `re`: Pattern matching for filters (imported conditionally)
- `linecache`: Source line retrieval (imported conditionally)  
- `tracemalloc`: Memory allocation tracking (imported conditionally)
- `_warnings`: C implementation fallback (optional)

**Key Invariants**:
- Filter tuples are always 5-element: (action, message_regex, category_class, module_regex, lineno)
- Registry keys use (text, category, lineno) for deduplication
- stacklevel >= 1, with frame navigation handling edge cases
- Module initialization processes sys.warnoptions and sets default filters