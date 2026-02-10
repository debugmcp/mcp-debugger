# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/json/scanner.py
@source-hash: 8604d9d03786d0d5
@generated: 2026-02-09T18:11:10Z

**Primary Purpose:** JSON token scanner factory that creates optimized scanning functions for parsing JSON tokens from strings. Provides fallback from C implementation to pure Python implementation.

**Key Functions:**

- `py_make_scanner(context)` (L15-71): Creates a pure Python JSON token scanner function. Takes a parsing context containing parse functions and configuration, returns a `scan_once` function for tokenizing JSON strings.
- `_scan_once(string, idx)` (L28-63): Core tokenization logic that parses individual JSON tokens starting at given string index. Handles all JSON data types: strings, objects, arrays, literals (null/true/false), numbers, and non-standard constants (NaN/Infinity).
- `scan_once(string, idx)` (L65-71): Wrapper around `_scan_once` that ensures memo cache is cleared after each scan operation.

**Key Components:**

- `NUMBER_RE` (L11-13): Regex pattern for matching JSON numbers including integers, decimals, and scientific notation
- `make_scanner` (L73): Main export that prefers C implementation (`c_make_scanner`) if available, otherwise uses Python fallback
- C extension fallback (L4-7): Attempts to import optimized C scanner, gracefully falls back to Python if unavailable

**Architecture Patterns:**

- **Strategy Pattern**: Dual implementation approach with C/Python fallback for performance optimization
- **Factory Pattern**: `make_scanner` creates scanner functions configured with parsing context
- **Closure Pattern**: Scanner functions capture context variables for efficient access during parsing

**Token Recognition Logic:**
- String literals: `"` character (L34-35)
- Objects: `{` character (L36-38) 
- Arrays: `[` character (L39-40)
- Literals: `null`, `true`, `false` by prefix matching (L41-46)
- Numbers: Regex-based parsing with integer/float distinction (L48-55)
- Non-standard constants: `NaN`, `Infinity`, `-Infinity` (L56-61)

**Dependencies:**
- `re` module for number pattern matching
- Context object providing parse functions (`parse_object`, `parse_array`, `parse_string`, etc.)
- Optional `_json` C extension for performance

**Critical Behavior:**
- Returns (value, next_index) tuples for successful parsing
- Raises `StopIteration(idx)` for parsing errors or end-of-input
- Clears memo cache after each scan to prevent memory leaks
- Supports both strict and non-strict parsing modes via context