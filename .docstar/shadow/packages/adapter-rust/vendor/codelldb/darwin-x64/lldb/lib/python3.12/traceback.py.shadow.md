# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/traceback.py
@source-hash: a96b7d5bfe46a8be
@generated: 2026-02-09T18:08:28Z

Python traceback module for extracting, formatting and printing stack traces and exception information.

## Primary Purpose
Provides comprehensive facilities for handling Python tracebacks and exceptions, including extraction from stack frames/traceback objects, formatting for display, and printing to files. Core functionality spans three main areas: traceback operations, stack operations, and exception formatting.

## Key Functions

### Traceback Operations
- `extract_tb(tb, limit=None)` (L61-75): Returns StackSummary from traceback object using extended frame generator with position info
- `format_tb(tb, limit=None)` (L57-59): Shorthand for formatting extracted traceback 
- `print_tb(tb, limit=None, file=None)` (L47-55): Prints formatted traceback to file (defaults to stderr)

### Stack Operations  
- `extract_stack(f=None, limit=None)` (L221-234): Extracts raw traceback from current stack frame, returns reversed StackSummary
- `format_stack(f=None, limit=None)` (L214-218): Formats extracted stack for printing
- `print_stack(f=None, limit=None, file=None)` (L202-211): Prints stack trace from invocation point

### Exception Formatting
- `format_exception(exc, value, tb, limit=None, chain=True)` (L128-140): Formats complete exception with stack trace as string list
- `print_exception(exc, value, tb, limit=None, file=None, chain=True)` (L111-125): Prints formatted exception
- `format_exception_only(exc, value)` (L143-157): Formats just the exception part without traceback

### Utility Functions
- `clear_frames(tb)` (L237-245): Clears local variable references in traceback frames to prevent memory leaks
- `walk_stack(f)` (L327-337): Generator yielding (frame, lineno) tuples walking up the stack
- `walk_tb(tb)` (L340-348): Generator yielding (frame, lineno) tuples walking down traceback chain

## Key Classes

### FrameSummary (L248-325)
Represents single frame from traceback with attributes:
- `filename`, `lineno`, `name`, `line` (source code text)
- `locals` (captured local variables as string representations)
- `colno`, `end_colno`, `end_lineno` (position info for error highlighting)
- Supports tuple-like access for backwards compatibility
- `line` property (L318-324) lazy-loads source via linecache

### StackSummary (L374-570)
List subclass containing FrameSummary objects representing complete stack.
- `extract(frame_gen, limit=None, lookup_lines=True, capture_locals=False)` (L377-397): Class method creating from frame generator
- `format()` (L525-570): Formats stack with recursive call detection and compression
- `format_frame_summary(frame_summary)` (L460-523): Formats individual frame with syntax error highlighting

### TracebackException (L679-1050)
Complete exception representation for rendering without holding references to original objects.
- Captures exception type, value, traceback, cause/context chains
- `format(chain=True)` (L944-1042): Main formatting method handling exception groups and chaining
- `format_exception_only()` (L869-906): Formats just exception message with notes
- Special handling for SyntaxError with caret positioning
- Exception group support with depth/width limits

## Internal Utilities

### Position/Display Handling
- `_walk_tb_with_full_positions(tb)` (L351-362): Enhanced traceback walker with complete position info
- `_get_code_position(code, instruction_index)` (L365-369): Extracts position from bytecode
- `_display_width(line, offset)` (L638-652): Calculates display width accounting for wide Unicode characters
- `_extract_caret_anchors_from_line_segment(segment)` (L589-634): AST-based caret positioning for syntax errors

### String Safety
- `_safe_string(value, what, func=str)` (L170-174): Safe string conversion with fallback for failed conversions
- `_format_final_exc_line(etype, value)` (L162-168): Formats final exception line

### Error Suggestion System
- `_compute_suggestion_error(exc_value, tb, wrong_name)` (L1067-1126): Suggests corrections for NameError/AttributeError/ImportError
- `_levenshtein_distance(a, b, max_cost)` (L1129-1187): Computes edit distance for name suggestions

## Dependencies
- `linecache`: Source code line retrieval and caching
- `sys`: System-specific parameters (stderr, frames, exception info)
- `collections.abc`: Abstract base classes for type checking  
- `itertools`: Iterator utilities for slicing and processing
- `textwrap`: Text formatting and indentation

## Constants
- `_RECURSIVE_CUTOFF = 3` (L372): Threshold for compressing repeated stack frames
- `_cause_message`, `_context_message` (L81-87): Standard exception chaining messages
- String similarity constants for suggestions: `_MAX_CANDIDATE_ITEMS`, `_MAX_STRING_SIZE`, `_MOVE_COST`, `_CASE_COST` (L1053-1056)