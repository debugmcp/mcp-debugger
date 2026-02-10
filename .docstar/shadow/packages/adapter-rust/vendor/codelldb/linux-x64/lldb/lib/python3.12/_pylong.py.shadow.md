# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/_pylong.py
@source-hash: 05da132ba9026334
@generated: 2026-02-09T18:09:31Z

## Purpose and Responsibility

Private module providing asymptotically faster algorithms for large integer operations in CPython. Designed for integers with many digits where performance overhead of Python implementation becomes negligible compared to asymptotic improvements. Used by `longobject.c` for operations exceeding certain size thresholds.

## Key Functions and Classes

### Integer to Decimal Conversion
- **`int_to_decimal(n)`** (L23-84): Fast int-to-Decimal conversion using divide-and-conquer with memoized powers of 2. Uses `w2pow()` helper (L43-60) for cached power computation and `inner()` recursive function (L62-68) for main algorithm. Sets maximum decimal precision context.
- **`int_to_decimal_string(n)`** (L87-129): String conversion with fallback strategies. Uses C decimal module for very large numbers (>450K bits), otherwise implements custom divide-and-conquer with base-10 powers cached in `pow10_cache`.

### String to Integer Conversion  
- **`_str_to_int_inner(s)`** (L132-176): Core string-to-int conversion using divide-and-conquer with memoized powers of 5. Helper `w5pow()` (L149-168) caches 5^w values. Achieves O(len(s)^1.58) complexity via Karatsuba multiplication.
- **`int_from_string(s)`** (L179-187): Public interface that strips underscores and whitespace before calling `_str_to_int_inner()`.
- **`str_to_int(s)`** (L190-199): Full string parsing with sign handling and regex validation.

### Fast Division Algorithm
- **`int_divmod(a, b)`** (L316-329): Main divmod interface with sign normalization, delegates to `_divmod_pos()` (L299-313).
- **`_div2n1n(a, b, n)`** (L210-237): Core 2n÷n bit division using Burnikel-Ziegler recursive algorithm. Calls `_div3n2n()` helper (L240-250) for 3n÷2n operations.
- **`_int2digits(a, n)`** (L253-281) and **`_digits2int(digits, n)`** (L284-296): Bidirectional conversion between integers and base-2^n digit arrays for division algorithm.

## Dependencies and Architecture

- **Standard library**: `re`, `decimal` (with optional `_decimal` C extension)
- **Algorithm sources**: Tim Peters (decimal conversion), Bjorn Martinsson (string parsing, division optimizations), Mark Dickinson (division base), Burnikel-Ziegler (division algorithm)
- **Integration**: Called by CPython's `longobject.c` when integer operations exceed size thresholds

## Critical Parameters and Thresholds

- `BITLIM = 128`: Threshold for direct vs recursive power computation in decimal conversion
- `DIGLIM = 2048`: Threshold for direct vs recursive computation in string parsing  
- `_DIV_LIMIT = 4000`: Threshold for switching to recursive division algorithm
- `450_000` bits: Threshold for using C decimal module vs fallback algorithm

## Notable Design Patterns

- **Memoization**: Extensive caching of intermediate power computations to avoid recomputation across recursion levels
- **Divide-and-conquer**: All algorithms use recursive splitting to achieve sub-quadratic complexity
- **Graceful fallback**: Decimal string conversion falls back to pure Python when C decimal unavailable
- **Context isolation**: Uses `decimal.localcontext()` to ensure maximum precision without affecting global state