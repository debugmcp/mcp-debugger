# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/_pylong.py
@source-hash: 05da132ba9026334
@generated: 2026-02-09T18:07:37Z

**Primary Purpose**: Private module providing asymptotically efficient algorithms for large integer operations in Python's longobject.c implementation. Optimizes operations that would otherwise be quadratic time by using divide-and-conquer strategies.

**Key Functions & Algorithms**:

- **`int_to_decimal(n)` (L23-84)**: Converts large integers to `decimal.Decimal` using divide-and-conquer approach with memoized power-of-2 calculations. Uses nested helper functions `w2pow()` for cached power calculation and `inner()` for recursive conversion. Sets maximum decimal precision context to avoid truncation.

- **`int_to_decimal_string(n)` (L87-129)**: Converts integers to decimal strings with fallback strategy. For very large integers (>450k bits) with C decimal module available, uses `int_to_decimal()`. Otherwise implements divide-and-conquer with base-10 powers using `pow10_cache` for memoization.

- **String-to-Integer Conversion**:
  - **`_str_to_int_inner(s)` (L132-176)**: Core divide-and-conquer string-to-int algorithm with O(n^1.58) complexity. Uses `w5pow()` helper for memoized powers of 5 and recursive `inner()` function.
  - **`int_from_string(s)` (L179-187)**: Wrapper that strips whitespace and underscores before calling `_str_to_int_inner()`
  - **`str_to_int(s)` (L190-199)**: Full string parser with regex validation and sign handling

- **Fast Division Algorithm (Burnikel-Ziegler)**:
  - **`_div2n1n(a, b, n)` (L210-237)**: Divides 2n-bit integer by n-bit integer recursively
  - **`_div3n2n(a12, a3, b, b1, b2, n)` (L240-250)**: Helper for division algorithm
  - **`int_divmod(a, b)` (L316-329)**: Public interface handling signs and calling `_divmod_pos()`
  - **`_divmod_pos(a, b)` (L299-313)**: Grade-school division in base 2^n using digit decomposition

- **Digit Manipulation**:
  - **`_int2digits(a, n)` (L253-281)**: Decomposes integer into base-2^n digits (little-endian)
  - **`_digits2int(digits, n)` (L284-296)**: Inverse operation reconstructing integer from digits

**Key Constants**:
- `BITLIM = 128` (L39): Threshold for direct vs. recursive power calculation
- `DIGLIM = 2048` (L145): Threshold for direct vs. recursive string conversion  
- `_DIV_LIMIT = 4000` (L207): Threshold for switching to built-in divmod

**Dependencies**:
- `decimal` module for high-precision arithmetic
- Optional `_decimal` C extension for performance
- `re` for string validation

**Architecture Notes**:
- Extensive use of memoization (`mem` dictionaries) to cache intermediate results
- Divide-and-conquer pattern throughout for O(n^1.58) complexity vs O(n^2)
- Graceful fallbacks when C extensions unavailable
- Designed specifically for very large integers where Python overhead is negligible compared to algorithmic improvements