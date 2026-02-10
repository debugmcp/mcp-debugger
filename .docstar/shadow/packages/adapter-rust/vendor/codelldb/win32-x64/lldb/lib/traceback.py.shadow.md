# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/traceback.py
@source-hash: a96b7d5bfe46a8be
@generated: 2026-02-09T18:14:33Z

## Primary Purpose
Python traceback formatting and exception handling module that provides comprehensive stack trace extraction, formatting, and printing capabilities. Core component of Python's error reporting system.

## Key Classes

### FrameSummary (L248-325)
Represents a single frame in a stack trace with attributes:
- `filename`, `lineno`, `name`: Basic frame identification
- `line`: Source code line (lazy-loaded via `linecache`)
- `locals`: Optional captured local variables as string representations
- Extended position info: `end_lineno`, `colno`, `end_colno` for precise error location
- Supports tuple-like access for backward compatibility

### StackSummary (L374-571)  
List subclass that manages collections of `FrameSummary` objects:
- `extract()` (L377-397): Creates from frame generators with optional line lookup and locals capture
- `from_list()` (L441-458): Creates from legacy tuple lists or existing FrameSummary objects
- `format()` (L525-570): Renders stack with recursive frame detection and compression
- `format_frame_summary()` (L460-523): Formats individual frames with syntax highlighting carets

### TracebackException (L679-1051)
Complete exception representation for rendering without holding references:
- Captures exception type, value, traceback, and contextual information
- Handles exception chaining (`__cause__`, `__context__`)
- Special handling for `SyntaxError`, `ImportError`, `NameError`, `AttributeError`
- Exception group formatting with configurable depth/width limits
- `format()` (L944-1043): Main formatting method with chaining support
- `from_exception()` (L851-854): Factory method for creating from live exceptions

## Core Functions

### Stack Operations
- `extract_stack()` (L221-234): Extracts current call stack
- `extract_tb()` (L61-75): Extracts from traceback objects
- `walk_stack()` (L327-337), `walk_tb()` (L340-348): Frame iteration utilities

### Formatting Functions
- `format_exception()` (L128-140): Complete exception formatting
- `format_exception_only()` (L143-157): Exception message only
- `format_tb()` (L57-59), `format_stack()` (L214-218): Stack formatting shortcuts

### Printing Functions
- `print_exception()` (L111-125): Main exception printer
- `print_exc()` (L178-180): Current exception shorthand
- `print_tb()` (L47-55), `print_stack()` (L202-211): Stack printing

## Important Dependencies
- `linecache`: Source line retrieval and caching
- `sys`: Frame access and exception state
- `collections.abc`: Type checking for sequences
- `textwrap`: Indentation for exception groups
- `ast`: Syntax analysis for caret positioning

## Notable Patterns

### Lazy Line Loading
Source lines loaded on-demand via `linecache` with caching optimization (L320-324, L433-438).

### Exception Chaining
Handles cause/context relationships with cycle detection using `_seen` set (L724-849).

### Recursive Frame Compression  
Detects repeated frames and summarizes with count (L538-570, `_RECURSIVE_CUTOFF = 3`).

### Enhanced Error Suggestions
Computes "Did you mean?" suggestions using Levenshtein distance algorithm (L1067-1187).

### Unicode-Aware Display
Handles wide characters and emojis in caret positioning (L638-652, `_display_width()`).

## Critical Invariants
- Frame extraction must handle `None` tracebacks gracefully
- Exception formatting must not hold references to original exception objects  
- Recursive exception chains must be detected to prevent infinite loops
- Line cache consistency maintained across frame extraction
- Display width calculations account for Unicode character rendering

## Internal Helpers
- `_parse_value_tb()` (L96-108): Parameter validation for backward compatibility
- `_safe_string()` (L170-174): Safe string conversion with fallbacks
- `_get_code_position()` (L365-369): Extracts precise code positions from bytecode
- `_ExceptionPrintContext` (L656-677): State management for exception group formatting