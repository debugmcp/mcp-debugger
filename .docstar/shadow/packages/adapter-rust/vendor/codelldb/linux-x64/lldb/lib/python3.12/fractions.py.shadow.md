# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/fractions.py
@source-hash: d52d1ab9d5be2692
@generated: 2026-02-09T18:09:48Z

## Purpose
Implements infinite-precision rational numbers via the `Fraction` class, providing exact arithmetic operations on fractions. Core Python stdlib module for rational number computation.

## Key Components

### Hash Implementation (L17-55)
- `_PyHASH_MODULUS` (L19): System hash modulus constant
- `_PyHASH_INF` (L22): Hash value for infinite rationals
- `_hash_algorithm()` (L24-55): LRU-cached function computing consistent hashes across numeric types using modular inverse algorithm

### String Parsing (L57-69)
- `_RATIONAL_FORMAT` (L57): Complex regex matching fraction strings, decimals, and scientific notation with optional underscores in digits

### Formatting Helpers (L74-159)
- `_round_to_exponent()` (L74-101): Rounds rational to nearest power of 10 multiple using ties-to-even
- `_round_to_figures()` (L103-140): Rounds to specified significant figures, returns (sign, significand, exponent)
- `_FLOAT_FORMAT_SPECIFICATION_MATCHER` (L144-159): Regex for parsing float-style format specs

### Main Fraction Class (L162-990)
**Constructor & Factory Methods:**
- `__new__()` (L186-289): Handles multiple input types (int, string, float, Decimal, Rational pairs)
- `from_float()` (L292-303): Exact float-to-fraction conversion
- `from_decimal()` (L306-315): Exact Decimal-to-fraction conversion  
- `_from_coprime_ints()` (L318-327): Internal constructor for pre-normalized fractions

**Core Properties & Methods:**
- `numerator`/`denominator` properties (L398-403): Access internal values
- `is_integer()` (L329-331): Tests if denominator is 1
- `as_integer_ratio()` (L333-338): Returns (numerator, denominator) tuple
- `limit_denominator()` (L340-395): Finds closest fraction with bounded denominator using continued fractions

**String Representation:**
- `__repr__()` (L405-408): Returns constructor-style representation
- `__str__()` (L410-415): Returns "n/d" or "n" format
- `__format__()` (L417-531): Comprehensive float-style formatting with scientific notation, precision, alignment

**Operator Framework (L533-641):**
- `_operator_fallbacks()` (L533-640): Meta-function generating forward/reverse operators with type coercion hierarchy

**Arithmetic Operations (L710-799):**
- `_add()`, `_sub()`, `_mul()`, `_div()` (L710-777): Optimized rational arithmetic using GCD algorithms from Knuth TAOCP
- `_floordiv()`, `_divmod()`, `_mod()` (L780-799): Integer division operations
- `__pow__()`, `__rpow__()` (L801-845): Power operations, rational for integer exponents

**Unary & Conversion Operations (L847-881):**
- `__pos__()`, `__neg__()`, `__abs__()` (L847-857): Unary operators
- `__int__()`, `__trunc__()`, `__floor__()`, `__ceil__()` (L859-880): Integer conversions
- `__round__()` (L882-906): Rounding with ties-to-even

**Comparison & Equality (L908-975):**
- `__hash__()` (L908-910): Uses cached hash algorithm
- `__eq__()` (L912-931): Handles multiple numeric types including NaN/infinity
- `_richcmp()` (L933-953): Generic comparison helper
- Comparison operators `__lt__`, `__gt__`, `__le__`, `__ge__` (L955-969)

**Object Protocol (L977-990):**
- Pickle/copy support via `__reduce__`, `__copy__`, `__deepcopy__`

## Architecture Patterns
- **Immutable Design**: Uses `__new__` constructor, immutable after creation
- **Normalized Representation**: Always maintains lowest-terms fractions with positive denominators
- **GCD Optimization**: Extensive use of `math.gcd()` for arithmetic efficiency
- **Type Coercion Hierarchy**: Systematic fallback handling for mixed-type operations
- **Caching**: LRU cache on hash computation for performance

## Dependencies
- `decimal.Decimal`: For exact decimal conversion
- `functools.lru_cache`: Hash computation caching
- `math.gcd`: Greatest common divisor calculations
- `numbers`: ABC hierarchy for type checking
- `operator`: Standard operators for fallback handling
- `re`: String parsing patterns