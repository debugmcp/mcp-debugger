# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/_pylong.py
@source-hash: 05da132ba9026334
@generated: 2026-02-09T18:07:05Z

## Purpose
Private module providing asymptotically faster algorithms for large integer operations in Python. Replaces quadratic-time implementations in longobject.c with divide-and-conquer algorithms for integers with many digits. Part of CPython's internal optimization stack.

## Key Functions

### Integer to Decimal Conversion
- **`int_to_decimal(n)` (L23-84)**: Converts large integers to `decimal.Decimal` using divide-and-conquer. Uses memoized power-of-2 computation via nested `w2pow()` (L43-60) and recursive `inner()` (L62-68). Sets maximum precision context to avoid inexact results.
- **`int_to_decimal_string(n)` (L87-129)**: Fast int-to-string conversion. Uses C decimal module for very large integers (>450k bits) or falls back to divide-and-conquer with cached powers of 10.

### String to Integer Conversion  
- **`_str_to_int_inner(s)` (L132-176)**: Core string-to-int algorithm using divide-and-conquer with memoized powers of 5 via `w5pow()` (L149-168). Achieves O(n^1.58) complexity via Karatsuba multiplication.
- **`int_from_string(s)` (L179-187)**: Clean wrapper that strips underscores and whitespace.
- **`str_to_int(s)` (L190-199)**: Public interface with regex parsing for sign and basic validation.

### Fast Division Algorithms
- **`_div2n1n(a, b, n)` (L210-237)**: Divides 2n-bit integer by n-bit integer using Burnikel-Ziegler recursive division. Falls back to built-in `divmod()` for small cases.
- **`_div3n2n(a12, a3, b, b1, b2, n)` (L240-250)**: Helper for `_div2n1n()` handling 3n-by-2n division cases.
- **`int_divmod(a, b)` (L316-329)**: Public interface for fast division with proper sign handling.

### Utility Functions
- **`_int2digits(a, n)` (L253-281)**: Decomposes integer into base-2^n digits using recursive splitting.
- **`_digits2int(digits, n)` (L284-296)**: Inverse operation reconstructing integer from digit array.
- **`_divmod_pos(a, b)` (L299-313)**: Grade-school division in base-2^n for positive integers.

## Dependencies
- **`decimal`**: For high-precision arithmetic contexts
- **`_decimal`**: Optional C implementation for performance
- **`re`**: For string parsing in `str_to_int()`

## Constants
- **`BITLIM = 128`**: Bit threshold for direct vs recursive computation in decimal conversion
- **`DIGLIM = 2048`**: Digit threshold for string conversion algorithms  
- **`_DIV_LIMIT = 4000`**: Bit threshold for switching to recursive division

## Architecture Notes
- All algorithms use divide-and-conquer with memoization for subproblem results
- Optimized for very large integers where asymptotic behavior dominates
- Graceful fallbacks to built-in operations for small cases
- Thread-unsafe due to function-local memoization dictionaries