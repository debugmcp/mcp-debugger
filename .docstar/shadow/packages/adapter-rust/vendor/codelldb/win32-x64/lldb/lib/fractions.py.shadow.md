# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/fractions.py
@source-hash: d52d1ab9d5be2692
@generated: 2026-02-09T18:13:08Z

## Purpose
Implements the `Fraction` class for infinite-precision rational number arithmetic. This is a Python standard library module providing exact fractional representations as numerator/denominator pairs.

## Key Classes and Functions

### Core Class: Fraction (L162-990)
Immutable rational number class inheriting from `numbers.Rational`. Uses `__slots__ = ('_numerator', '_denominator')` for memory efficiency.

**Construction** (`__new__`, L186-289):
- From integers: `Fraction(3, 4)` 
- From strings: `Fraction('3/4')`, `Fraction('1.5')`, `Fraction('1e-3')`
- From floats/Decimals: exact conversion via `as_integer_ratio()`
- From other Rational instances
- Automatically reduces to lowest terms using `math.gcd()`

**Class Methods**:
- `from_float(cls, f)` (L292-303): Exact float-to-fraction conversion
- `from_decimal(cls, dec)` (L306-315): Exact Decimal-to-fraction conversion  
- `_from_coprime_ints(cls, num, denom)` (L318-327): Internal constructor for pre-reduced fractions

**Core Methods**:
- `limit_denominator(max_denominator=1000000)` (L340-395): Finds closest fraction with bounded denominator using continued fraction algorithm
- `is_integer()` (L329-331): Returns True if denominator is 1
- `as_integer_ratio()` (L333-338): Returns (numerator, denominator) tuple

### Hash Implementation
**`_hash_algorithm(numerator, denominator)`** (L25-55): LRU-cached hash function ensuring hash consistency between equivalent Fraction, int, float, and Decimal values. Uses modular arithmetic with `_PyHASH_MODULUS`.

### String Parsing
**`_RATIONAL_FORMAT`** (L57-69): Complex regex for parsing fraction strings, supporting:
- Integer notation: "123"
- Fraction notation: "123/456" 
- Decimal notation: "123.456"
- Scientific notation: "1.23e-4"
- Underscores in numbers: "1_234"

### Formatting Support
**`_round_to_exponent(n, d, exponent, no_neg_zero=False)`** (L74-100): Rounds rational to nearest multiple of 10^exponent using round-half-to-even.

**`_round_to_figures(n, d, figures)`** (L103-139): Rounds rational to specified significant figures, returns (sign, significand, exponent).

**`_FLOAT_FORMAT_SPECIFICATION_MATCHER`** (L144-159): Regex for parsing float-style format specifications supporting 'e', 'E', 'f', 'F', 'g', 'G', '%' types.

**`__format__(format_spec)`** (L417-531): Comprehensive formatting implementation supporting all float format types with proper rounding, padding, alignment, and thousands separators.

### Arithmetic Operations
**Operator Fallback System** (`_operator_fallbacks`, L533-640): Meta-function generating forward/reverse operators with intelligent type coercion:
- Fraction + Fraction → exact rational arithmetic
- Fraction + int → convert int to Fraction  
- Fraction + float/complex → convert Fraction to float/complex
- Handles mixed-type operations gracefully

**Optimized Rational Arithmetic** (L642-709): Implements Knuth's algorithms (TAOCP Vol 2, 4.5.1):
- Addition/subtraction: Uses GCD optimization to work with smaller intermediate values
- Multiplication: Cross-reduces factors before multiplication
- Special-cases coprime operands (60.8% of random integer pairs)

**Core Operations**:
- `_add`, `_sub` (L710-738): GCD-optimized addition/subtraction
- `_mul` (L742-754): Cross-reduction multiplication  
- `_div` (L758-776): Division with sign normalization
- `_floordiv`, `_divmod`, `_mod` (L780-798): Integer division operations
- `__pow__` (L801-845): Power operations, rational for integer exponents

### Comparison and Conversion
**`_richcmp(self, other, op)`** (L933-953): Unified comparison helper handling Rational and float operands.

**Conversion Methods**:
- `__int__`, `__trunc__` (L859-871): Integer conversion
- `__floor__`, `__ceil__` (L873-880): Floor/ceiling operations
- `__round__(ndigits=None)` (L882-906): Round-half-to-even implementation
- `__float__`, `__complex__`: Inherited from numbers.Rational

### Utility Methods
- `__eq__` (L912-931): Equality with special float/complex handling
- `__hash__` (L908-910): Delegates to `_hash_algorithm`
- `__bool__` (L971-975): Non-zero test
- Pickle/copy support (L979-990): Immutability-aware copying

## Dependencies
- `decimal.Decimal`: For exact decimal conversion
- `numbers`: ABC framework integration  
- `math`: GCD operations and special functions
- `operator`: Fallback operations
- `functools.lru_cache`: Hash caching
- `re`: String parsing

## Design Patterns
- **Immutable Value Type**: Uses `__new__` instead of `__init__`, `__slots__` for efficiency
- **Automatic Normalization**: Always maintains lowest-terms representation
- **Exact Arithmetic**: Preserves precision unlike floating-point
- **Type Coercion Hierarchy**: Intelligent mixed-type operation handling
- **Performance Optimization**: GCD-based algorithms, caching, special-case handling