# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/traceback.py
@source-hash: a96b7d5bfe46a8be
@generated: 2026-02-09T18:09:29Z

## Python Standard Library Traceback Module

Core module for extracting, formatting and printing Python stack traces and exception information. Provides comprehensive traceback handling with support for exception chaining, local variable capture, and modern Python position information.

### Primary Classes

**FrameSummary (L248-325)**: Represents a single stack frame with attributes:
- `filename`, `lineno`, `name`, `line` for basic frame info
- `locals` for captured variable representations  
- `colno`, `end_colno`, `end_lineno` for precise error positioning
- Implements tuple-like interface for backward compatibility

**StackSummary (L374-570)**: List of FrameSummary objects representing a complete stack trace
- `extract()` (L377-397): Creates from frame generators with configurable limits and line lookup
- `_extract_from_extended_frame_gen()` (L400-439): Internal method handling position info
- `from_list()` (L442-458): Creates from legacy tuple format or FrameSummary objects
- `format()` (L525-570): Renders stack with recursive frame detection and compression

**TracebackException (L679-1043)**: Self-contained exception representation for safe rendering
- Captures exception details without holding references to original objects
- Handles exception chaining (`__cause__`, `__context__`)
- Supports exception groups with configurable depth/width limits
- `format()` (L944-1042): Complete exception formatting with chaining support
- `format_exception_only()` (L869-906): Exception message formatting only

### Key Functions

**Stack Extraction**:
- `extract_tb(tb, limit)` (L61-75): Extracts traceback frames into StackSummary
- `extract_stack(f, limit)` (L221-234): Extracts current stack frames
- `walk_tb(tb)` (L340-348): Generator yielding (frame, lineno) from traceback
- `walk_stack(f)` (L327-337): Generator yielding (frame, lineno) from stack

**Formatting Functions**:
- `format_exception(exc, value, tb)` (L128-140): Complete exception formatting
- `format_tb(tb, limit)` (L57-59): Traceback-only formatting
- `format_list(extracted_list)` (L29-41): Generic list formatting

**Printing Functions**:
- `print_exception(exc, value, tb)` (L111-125): Print complete exception
- `print_exc()` (L178-180): Print current exception
- `print_tb(tb)` (L47-55): Print traceback only

### Error Suggestion System

**Suggestion Engine (L1067-1126)**: Computes "did you mean" suggestions using Levenshtein distance
- `_compute_suggestion_error()`: Main suggestion logic for NameError, AttributeError, ImportError
- `_levenshtein_distance()` (L1129-1187): Optimized edit distance calculation
- Handles attribute access suggestions (`self.attribute_name`) for method contexts

### Internal Utilities

**Position Handling**:
- `_walk_tb_with_full_positions(tb)` (L351-362): Enhanced walk with column info
- `_get_code_position(code, instruction_index)` (L365-369): Extracts position from bytecode
- `_byte_offset_to_character_offset()` (L573-575): UTF-8 byte to character conversion

**Caret Display**:
- `_extract_caret_anchors_from_line_segment()` (L589-634): AST-based caret positioning
- `_display_width()` (L638-652): Unicode-aware width calculation for terminals

### Constants and Sentinels

- `_RECURSIVE_CUTOFF = 3` (L372): Threshold for recursive frame compression
- `_sentinel` (L94): Distinguishes between None and unspecified parameters
- `_cause_message`, `_context_message` (L81-87): Exception chaining headers

### Dependencies
- `linecache`: Source code line retrieval with caching
- `ast`: AST parsing for precise error caret positioning  
- `unicodedata`: Wide character support for terminal display
- `collections`, `itertools`, `textwrap`: Standard collection/formatting utilities