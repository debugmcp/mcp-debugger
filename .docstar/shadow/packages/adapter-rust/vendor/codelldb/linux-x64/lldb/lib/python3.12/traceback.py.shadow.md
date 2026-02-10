# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/traceback.py
@source-hash: a96b7d5bfe46a8be
@generated: 2026-02-09T18:10:24Z

## Core Purpose
Python's standard traceback module that extracts, formats, and prints stack trace information for debugging and error reporting. Provides high-level APIs for traceback manipulation and exception formatting.

## Key Classes and Functions

### Stack/Traceback Extraction Functions (L21-246)
- `print_list()` (L21): Prints formatted stack traces from extracted frame lists
- `format_list()` (L29): Converts frame lists to formatted strings via StackSummary
- `extract_tb(tb, limit=None)` (L61): Extracts StackSummary from traceback objects using `_walk_tb_with_full_positions()`
- `print_tb()` (L47), `format_tb()` (L57): Convenience wrappers for traceback printing/formatting
- `extract_stack()` (L221): Extracts current call stack frames, reverses order for chronological display
- `walk_stack()` (L327), `walk_tb()` (L340): Core generators that traverse frame chains

### Exception Formatting Functions (L111-196)
- `print_exception()` (L111): Main exception printer using TracebackException class
- `format_exception()` (L128): Returns formatted exception as string list
- `format_exception_only()` (L143): Formats just the exception message/type without traceback
- `print_exc()` (L178), `format_exc()` (L182): Convenience functions using `sys.exception()`
- `_parse_value_tb()` (L96): Internal parameter validation for exception functions

### Data Classes

#### FrameSummary (L248-325)
Immutable representation of a single stack frame with:
- Core attributes: filename, lineno, name, line text
- Position data: end_lineno, colno, end_colno for precise error locations  
- Lazy line loading via `line` property (L318) using linecache
- Tuple compatibility via `__getitem__` and `__iter__` for backward compatibility

#### StackSummary (L374-570)  
List subclass managing collections of FrameSummary objects:
- `extract()` (L377): Class method creating from frame generators
- `_extract_from_extended_frame_gen()` (L400): Core extraction with enhanced position info
- `format()` (L525): Smart formatting with recursive frame detection and compression
- `format_frame_summary()` (L460): Formats individual frames with syntax highlighting carets

#### TracebackException (L679-1050)
Comprehensive exception representation capturing all error context:
- Constructor (L718): Processes exception chains (__cause__/__context__) iteratively to avoid recursion
- Exception group support with depth/width limits (max_group_depth=10, max_group_width=15)
- Special handling for SyntaxError with precise position info (L747-757)
- Smart error suggestions for NameError/AttributeError/ImportError (L764-776)
- `format()` (L944): Main formatting method with chained exception support

## Critical Internal Functions

### Position and Display Handling (L351-652)
- `_walk_tb_with_full_positions()` (L351): Enhanced traceback walker with column positions
- `_get_code_position()` (L365): Extracts position info from bytecode using `co_positions()`
- `_display_width()` (L638): Calculates display width accounting for wide Unicode characters
- `_extract_caret_anchors_from_line_segment()` (L589): AST-based caret positioning for syntax errors

### Error Suggestion System (L1067-1187)
- `_compute_suggestion_error()` (L1067): Main suggestion engine using Levenshtein distance
- `_levenshtein_distance()` (L1129): Optimized string distance calculation with early termination
- Handles AttributeError (dir() inspection), ImportError (module inspection), NameError (frame locals/globals)

### Utility Functions
- `clear_frames()` (L237): Clears frame references to prevent memory leaks
- `_safe_string()` (L170): Robust string conversion with fallback for repr() failures
- `_format_final_exc_line()` (L162): Exception type:message formatting

## Architecture Patterns
- **Lazy Loading**: Line text retrieved on-demand via linecache integration
- **Recursive Detection**: `_RECURSIVE_CUTOFF = 3` prevents infinite frame display
- **Chain Processing**: Queue-based processing prevents recursion in exception chains
- **Unicode Safety**: Comprehensive handling of wide characters and display width
- **AST Integration**: Uses AST parsing for enhanced syntax error positioning

## Key Dependencies
- `linecache`: Source code line retrieval and caching
- `sys`: Frame introspection and interpreter state
- `ast`: Syntax error position enhancement
- `unicodedata`: Display width calculations
- `collections.abc`: Type checking for sequences