# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/_pylong.py
@source-hash: 05da132ba9026334
@generated: 2026-02-09T18:08:33Z

## Purpose
Private optimization module providing asymptotically faster algorithms for operations on very large integers. Used internally by CPython's longobject.c to replace quadratic-time base conversion and division algorithms with divide-and-conquer approaches optimized for integers with thousands of digits.

## Key Functions

### Integer to Decimal Conversion
- **`int_to_decimal(n)` (L23-84)**: Primary conversion function using divide-and-conquer algorithm with O(n log n) complexity. Uses decimal.Decimal with maximum precision context. Contains nested helper functions:
  - `w2pow(w)` (L43-60): Memoized power-of-2 computation for Decimal objects
  - `inner(n, w)` (L62-68): Recursive binary decomposition of integer bits
- **`int_to_decimal_string(n)` (L87-129)**: String conversion with fallback algorithm when C decimal module unavailable. Uses 10^i = 5^i * 2^i optimization and pow10_cache for memoization.

### String to Integer Conversion  
- **`_str_to_int_inner(s)` (L132-176)**: Core conversion using divide-and-conquer with O(n^1.58) complexity via Karatsuba multiplication. Contains:
  - `w5pow(w)` (L149-168): Memoized power-of-5 computation
  - `inner(a, b)` (L170-174): Recursive string slice processing
- **`int_from_string(s)` (L179-187)**: Preprocesses string by removing underscores and whitespace
- **`str_to_int(s)` (L190-199)**: Full parser with sign handling and regex validation

### Fast Integer Division
- **`int_divmod(a, b)` (L316-329)**: Main divmod replacement with O(n^1.58) complexity, handles sign normalization
- **`_divmod_pos(a, b)` (L299-314)**: Positive integer division using grade-school algorithm in base 2^n
- **`_div2n1n(a, b, n)` (L210-237)**: Burnikel-Ziegler recursive division for 2n-bit by n-bit integers
- **`_div3n2n(a12, a3, b, b1, b2, n)` (L240-250)**: Helper function for _div2n1n

### Utility Functions
- **`_int2digits(a, n)` (L253-281)**: Decomposes integer into base-2^n digits (little-endian)
- **`_digits2int(digits, n)` (L284-296)**: Inverse operation, combines digits back into integer

## Key Dependencies
- `decimal` module for high-precision arithmetic
- `_decimal` (C implementation) for optimal performance on very large numbers (>450k bits)
- `re` for string parsing

## Performance Thresholds
- **BITLIM = 128**: Threshold for direct vs recursive power computation
- **DIGLIM = 2048**: Threshold for direct vs recursive string conversion  
- **_DIV_LIMIT = 4000**: Threshold for built-in vs recursive division
- **450,000 bits**: Threshold for using C decimal implementation

## Architectural Notes
- Extensive memoization used throughout for intermediate results
- Divide-and-conquer strategy replaces quadratic algorithms in longobject.c
- Designed for clarity over micro-optimizations per module docstring
- All functions assume well-formed input (preprocessing done at C level)