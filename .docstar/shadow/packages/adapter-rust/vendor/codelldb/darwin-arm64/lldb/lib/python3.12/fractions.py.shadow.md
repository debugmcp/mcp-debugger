# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/fractions.py
@source-hash: d52d1ab9d5be2692
@generated: 2026-02-09T18:07:22Z

## Primary Purpose
Python's standard library implementation of rational numbers (fractions) with exact arithmetic operations. Provides the `Fraction` class for representing and manipulating rational numbers as numerator/denominator pairs in lowest terms.

## Key Components

### Constants and Utilities (L17-23)
- `_PyHASH_MODULUS`, `_PyHASH_INF`: Hash implementation constants from sys.hash_info
- `_hash_algorithm(numerator, denominator)` (L24-55): LRU-cached hash computation using modular arithmetic for consistent hashing across numeric types

### String Parsing (L57-69)
- `_RATIONAL_FORMAT`: Complex regex pattern for parsing fraction strings, supporting:
  - Simple fractions ("3/4")
  - Decimal notation ("3.14")
  - Scientific notation ("1e-5")
  - Underscores in numbers ("1_000/3_000")

### Formatting Helpers (L74-160)
- `_round_to_exponent(n, d, exponent, no_neg_zero)` (L74-100): Rounds rational to nearest power of 10 multiple
- `_round_to_figures(n, d, figures)` (L103-139): Rounds to specified significant figures
- `_FLOAT_FORMAT_SPECIFICATION_MATCHER` (L144-159): Regex for parsing float-style format specs

### Core Fraction Class (L162-990)

#### Construction and Conversion (L186-327)
- `__new__(cls, numerator, denominator)` (L186-289): Main constructor handling multiple input types:
  - Two integers (numerator, denominator)
  - Single argument: int, float, Decimal, string, or Rational
  - Automatic GCD reduction and sign normalization
- `from_float(cls, f)` (L292-303): Exact float-to-fraction conversion
- `from_decimal(cls, dec)` (L306-315): Exact Decimal-to-fraction conversion
- `_from_coprime_ints(cls, numerator, denominator)` (L318-327): Internal constructor for pre-reduced fractions

#### Properties and Basic Methods (L329-415)
- `numerator`, `denominator` properties (L398-403): Access to reduced components
- `is_integer()` (L329-331): Check if denominator is 1
- `as_integer_ratio()` (L333-338): Return (numerator, denominator) tuple
- `limit_denominator(max_denominator)` (L340-395): Find closest fraction with bounded denominator using continued fractions
- `__repr__`, `__str__` (L405-415): String representations

#### Advanced Formatting (L417-531)
- `__format__(format_spec)` (L417-531): Comprehensive formatting supporting:
  - Float-style format specs (e, f, g, %, etc.)
  - Precision, alignment, padding, thousands separators
  - Scientific notation, alternate forms

#### Arithmetic Operations (L533-799)

##### Operator Fallback System (L533-640)
- `_operator_fallbacks(monomorphic_operator, fallback_operator)` (L533-640): Generates forward/reverse operators with mixed-type handling:
  - Direct rational arithmetic for Fraction/int operands
  - Float conversion for float operands
  - Complex conversion for complex operands
  - Proper NotImplemented returns for unknown types

##### Optimized Rational Arithmetic (L642-799)
Based on Knuth TAOCP algorithms with GCD optimizations:
- `_add(a, b)` (L710-722): Addition with GCD-based optimization
- `_sub(a, b)` (L726-738): Subtraction with GCD-based optimization  
- `_mul(a, b)` (L742-754): Multiplication with cross-GCD reduction
- `_div(a, b)` (L758-776): Division with proper sign handling
- `_floordiv`, `_divmod`, `_mod` (L780-799): Integer division operations

#### Power Operations (L801-845)
- `__pow__(a, b)` (L801-831): Handles integer powers exactly, falls back to float for fractional powers
- `__rpow__(b, a)` (L833-845): Reverse power with optimization for integer bases

#### Unary Operations (L847-880)
- `__pos__`, `__neg__`, `__abs__` (L847-857): Sign operations
- `__int__`, `__trunc__`, `__floor__`, `__ceil__` (L859-880): Integer conversions

#### Rounding (L882-906)
- `__round__(ndigits)` (L882-906): Round-half-to-even implementation with optional decimal places

#### Comparison and Hashing (L908-975)
- `__hash__()` (L908-910): Uses cached `_hash_algorithm`
- `__eq__(a, b)` (L912-931): Equality with special float/complex handling
- `_richcmp(self, other, op)` (L933-953): Helper for comparison operators
- `__lt__`, `__gt__`, `__le__`, `__ge__` (L955-969): Comparison operators
- `__bool__(a)` (L971-975): Truthiness test

#### Serialization Support (L979-990)
- `__reduce__`, `__copy__`, `__deepcopy__`: Pickle and copy support with immutability optimization

## Architecture Notes

### Invariants
- Fractions always stored in lowest terms (GCD of numerator/denominator is 1)
- Denominator is always positive (sign stored in numerator)
- Uses `__slots__` for memory efficiency

### Performance Optimizations
- GCD-based arithmetic algorithms minimize intermediate results
- Special cases for coprime operands (60.8% of random integer pairs)
- LRU cache for hash computation
- Immutability allows copy optimization

### Dependencies
- `math.gcd` for greatest common divisor calculations
- `numbers` abstract base classes for type hierarchy
- `decimal.Decimal` for exact decimal conversion
- `operator` module for fallback arithmetic