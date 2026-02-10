# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/warnings.py
@source-hash: adb02ef44e1e9bf9
@generated: 2026-02-09T18:14:28Z

**Primary Purpose**: Core Python warnings subsystem implementation that provides warning filtering, formatting, and display mechanisms. This module can function standalone or be replaced by the optimized C implementation `_warnings`.

**Key Classes**:
- `WarningMessage` (L416-436): Data container for warning details with attributes for message, category, filename, lineno, file, line, and source
- `catch_warnings` (L438-512): Context manager for temporarily capturing/modifying warning behavior, supports recording warnings to a list and restoring original state
- `_OptionError` (L203-205): Internal exception for command-line option parsing errors

**Core Warning Functions**:
- `warn()` (L299-344): Main entry point for issuing warnings with stacklevel support and frame skipping
- `warn_explicit()` (L345-414): Lower-level warning function with explicit filename/lineno, handles filter matching and action execution
- `showwarning()` (L10-13): Hook for writing warnings to files, delegates to `_showwarnmsg_impl`
- `formatwarning()` (L15-18): Standard warning formatting function

**Filter Management**:
- `filterwarnings()` (L133-167): Insert regex-based warning filters with action, message pattern, category, module pattern
- `simplefilter()` (L168-182): Insert simple filters matching all modules/messages
- `resetwarnings()` (L198-201): Clear all active filters
- `_add_filter()` (L184-196): Internal filter list management with deduplication

**Internal Implementation**:
- `_showwarnmsg_impl()` (L20-33): Core warning display logic with stderr fallback and OSError handling
- `_formatwarnmsg_impl()` (L35-94): Warning text formatting with source line extraction and tracemalloc integration
- `_showwarnmsg()` (L99-115) / `_formatwarnmsg()` (L120-131): Delegation wrappers that check for user replacements

**Command Line Processing**:
- `_processoptions()` (L208-213): Process `-W` command line options
- `_setoption()` (L216-241): Parse individual warning option strings
- `_getaction()` (L244-251) / `_getcategory()` (L254-272): Parse action names and warning categories

**Frame Analysis**:
- `_is_internal_filename()` (L275-276): Detect Python internal importlib frames
- `_next_external_frame()` (L288-295): Skip internal/user-specified frames for accurate stack reporting
- `_is_internal_frame()` (L283-285): Check if frame is CPython implementation detail

**Special Utilities**:
- `_deprecated()` (L516-532): Deprecation warning helper with version checking
- `_warn_unawaited_coroutine()` (L536-555): Specialized coroutine warning with origin tracking

**Module State**: 
Global variables `filters`, `defaultaction`, `onceregistry` are either imported from C `_warnings` module (L567-571) or initialized as Python fallbacks (L572-583). Module initialization processes command-line options and sets default filters (L587-597).

**Architecture**: Dual implementation design where optimized C code can replace Python functions. Uses delegation pattern with original function references (`_showwarning_orig`, `_formatwarning_orig`) to detect user customizations.