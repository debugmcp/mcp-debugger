# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/traceback.py
@source-hash: a96b7d5bfe46a8be
@generated: 2026-02-09T18:07:38Z

## Primary Purpose
Python's traceback module for extracting, formatting, and printing stack trace information. Provides comprehensive tools for exception handling, traceback formatting, and error reporting with support for modern Python features like exception groups and enhanced error messages.

## Core Classes

### FrameSummary (L248-325)
Represents a single frame from a traceback with attributes:
- `filename`, `lineno`, `name`, `line` - basic frame info
- `locals` - captured local variables as string representations
- `colno`, `end_colno`, `end_lineno` - enhanced position info for Python 3.11+
- Supports tuple-like access for backward compatibility
- Lazy line loading via `linecache`

### StackSummary (L374-571)
List-like container of FrameSummary objects representing complete stack traces:
- `extract()` (L377-397) - creates from frame generators with configurable limits
- `_extract_from_extended_frame_gen()` (L400-439) - handles full position info
- `from_list()` (L442-458) - creates from legacy tuple lists
- `format()` (L525-571) - formats for display with recursive call detection
- `format_frame_summary()` (L460-523) - formats individual frames with caret indicators

### TracebackException (L679-1051)
Complete exception representation for rendering without holding references:
- Constructor (L718-849) handles exception chaining, syntax errors, and exception groups
- `from_exception()` (L851-854) - factory method
- `format()` (L944-1042) - generates formatted output with chain support
- `format_exception_only()` (L869-907) - formats just exception info
- Special handling for SyntaxError, ImportError, NameError, AttributeError
- Exception group formatting with depth/width limits

### _ExceptionPrintContext (L656-677)
Internal helper for managing indentation and formatting of nested exception groups.

## Key Functions

### Traceback Extraction
- `extract_tb()` (L61-75) - extracts StackSummary from traceback
- `extract_stack()` (L221-234) - extracts current call stack
- `walk_tb()` (L340-348) - iterates traceback frames
- `walk_stack()` (L327-337) - iterates stack frames
- `_walk_tb_with_full_positions()` (L351-362) - enhanced position extraction

### Formatting Functions
- `format_tb()`, `format_stack()` (L57-59, L214-218) - format as strings
- `format_exception()` (L128-140) - complete exception formatting
- `format_exception_only()` (L143-157) - exception message only
- `format_list()` (L29-41) - format frame lists

### Printing Functions
- `print_tb()`, `print_stack()` (L47-55, L202-211) - print to stderr
- `print_exception()` (L111-125) - print complete exception
- `print_exc()` (L178-180) - print current exception
- `print_last()` (L186-195) - print last exception

### Utility Functions
- `clear_frames()` (L237-245) - clear local variable references
- `_safe_string()` (L170-174) - safe string conversion with fallback
- `_format_final_exc_line()` (L162-168) - format exception name/message

## Advanced Features

### Enhanced Error Messages (L758-776)
Automatic suggestion generation for NameError, AttributeError, ImportError using Levenshtein distance algorithm (`_compute_suggestion_error()` L1067-1126, `_levenshtein_distance()` L1129-1187).

### Caret Positioning (L589-634)
Smart caret placement for syntax errors using AST parsing (`_extract_caret_anchors_from_line_segment()`) with support for binary operations and subscripts.

### Display Width Calculation (L638-652)
Unicode-aware width calculation (`_display_width()`) for proper alignment with wide characters and emojis.

## Key Dependencies
- `linecache` - source line retrieval and caching
- `sys` - frame access and exception info
- `collections.abc` - type checking
- `ast` - syntax error caret positioning
- `unicodedata` - display width calculation

## Important Constants
- `_RECURSIVE_CUTOFF = 3` (L372) - threshold for recursive call detection
- `_MAX_CANDIDATE_ITEMS = 750` (L1053) - limit for suggestion candidates
- `_MAX_STRING_SIZE = 40` (L1054) - limit for suggestion string length

## Architectural Notes
- Maintains backward compatibility with tuple-based frame representations
- Uses generators extensively for memory efficiency
- Implements cycle detection for exception chains
- Supports both legacy and modern exception handling patterns
- Exception groups use iterative processing to avoid recursion limits