# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/_pylong.py
@source-hash: 05da132ba9026334
@generated: 2026-02-09T18:12:51Z

## Python Long Integer Optimization Module

Private module providing asymptotically faster algorithms for large integer operations, designed to replace quadratic-time C implementations in `longobject.c`. Optimized for integers with massive digit counts where Python overhead is negligible compared to algorithmic improvements.

**Dependencies:** `re`, `decimal`, optional `_decimal` (C implementation)

### Core Functions

**`int_to_decimal(n)` (L23-84)**
- Converts large integers to `decimal.Decimal` using divide-and-conquer
- Tim Peters algorithm with O(log n) complexity vs quadratic baseline
- Uses memoized power-of-2 calculation via nested `w2pow()` (L43-60)
- Recursive `inner()` function (L62-68) splits number by bit position
- Sets maximum precision context to avoid rounding errors

**`int_to_decimal_string(n)` (L87-129)**
- Fast integer-to-string conversion with fallback strategy
- Uses `int_to_decimal()` for very large numbers (>450k bits) when C decimal available
- Fallback algorithm uses cached powers of 10 and recursive splitting
- Estimates decimal digits using `log10(2) * bit_length` (L117)

**`_str_to_int_inner(s)` (L132-176)**
- Bjorn Martinsson's O(n^1.58) string-to-int algorithm using Karatsuba multiplication
- Memoized powers of 5 via `w5pow()` (L149-168)
- Recursive `inner()` splits string and combines with appropriate powers

**`int_from_string(s)` / `str_to_int(s)` (L179-199)**
- Public interfaces for string conversion with input validation
- `str_to_int` handles sign parsing with regex matching

### Fast Division Algorithm (L202-329)

**`_div2n1n(a, b, n)` (L210-237)**
- Burnikel-Ziegler recursive division for 2n-bit by n-bit integers
- Calls `_div3n2n()` helper for sub-problems
- Bit padding for odd n values

**`_div3n2n(a12, a3, b, b1, b2, n)` (L240-250)**
- Helper implementing 3n-by-2n division step
- Handles quotient estimation and remainder correction

**`_int2digits(a, n)` / `_digits2int(digits, n)` (L253-296)**
- Base conversion utilities for grade-school division algorithm
- Recursive decomposition/recomposition in base 2^n

**`int_divmod(a, b)` (L316-329)**
- Public O(n^1.58) replacement for built-in divmod
- Handles sign normalization, delegates to `_divmod_pos()`

### Constants
- `_DIV_LIMIT = 4000` (L207): Threshold for switching to built-in division
- `BITLIM = 128` (L39): Bit limit for direct decimal power calculation
- `DIGLIM = 2048` (L145): Digit limit for direct string-to-int conversion

### Architecture Notes
- All algorithms use divide-and-conquer with memoization
- Designed for integers exceeding standard arithmetic limits
- Fallback mechanisms when C decimal module unavailable
- Clear preference for maintainability over micro-optimizations