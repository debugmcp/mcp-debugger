# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/json/scanner.py
@source-hash: 8604d9d03786d0d5
@generated: 2026-02-09T18:06:14Z

## JSON Token Scanner

Core JSON tokenization module providing scanner factory functions for parsing JSON strings character by character.

**Primary Purpose:** Creates scanner functions that parse individual JSON tokens from strings, handling both primitive values (strings, numbers, booleans, null) and complex structures (objects, arrays).

**Key Components:**

- `NUMBER_RE` (L11-13): Compiled regex pattern for matching JSON numbers, capturing integer part, optional fractional part, and optional exponent with full compliance to JSON number format
- `py_make_scanner(context)` (L15-71): Pure Python scanner factory that creates closures with context-specific parsers
- `_scan_once(string, idx)` (L28-63): Internal recursive tokenizer that identifies and parses the next JSON token at given string index
- `scan_once(string, idx)` (L65-71): Public wrapper that clears memoization after each scan operation

**Token Parsing Logic (_scan_once):**
- String literals: `"` prefix → delegate to `parse_string` (L34-35)
- Objects: `{` prefix → delegate to `parse_object` with recursive scanning (L36-38)
- Arrays: `[` prefix → delegate to `parse_array` with recursive scanning (L39-40)
- Literals: `null`, `true`, `false` → direct parsing with bounds checking (L41-46)
- Numbers: Regex match → conditional float/int parsing based on decimal/exponent presence (L48-55)
- Special values: `NaN`, `Infinity`, `-Infinity` → delegate to `parse_constant` (L56-61)

**Architecture Decisions:**
- C extension fallback pattern: Prefers `c_make_scanner` from `_json` module if available, falls back to pure Python implementation (L4-7, L73)
- Closure-based design: Scanner functions capture parsing context to avoid parameter passing overhead
- Memoization management: Automatic memo clearing after each scan to prevent memory leaks (L69)
- Early termination: Uses `StopIteration` exceptions for end-of-input and parse error signaling

**Dependencies:**
- Context object must provide: `parse_object`, `parse_array`, `parse_string`, `parse_float`, `parse_int`, `parse_constant`, plus configuration flags (`strict`, hooks, `memo`)
- Optional C extension `_json` for performance optimization

**Return Format:** All parsing functions return `(parsed_value, next_index)` tuples for consistent state management.