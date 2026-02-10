# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/fractions.py
@source-hash: d52d1ab9d5be2692
@generated: 2026-02-09T18:08:51Z

## Python fractions.py - Rational Number Implementation

**Primary Purpose**: Implements infinite-precision rational number arithmetic through the `Fraction` class, providing exact fractional representation and operations.

### Key Classes & Functions

#### Fraction Class (L162-990)
Core rational number implementation inheriting from `numbers.Rational`. Uses `__slots__` for memory efficiency with `_numerator` and `_denominator` attributes.

**Constructor** (`__new__`, L186-289): Flexible construction supporting:
- Integer pairs: `Fraction(8, 6)` → `Fraction(4, 3)`
- Strings: `'3/2'`, `'1.5'`, `'-47e-2'`
- Float/Decimal instances (exact conversion via `as_integer_ratio()`)
- Other Rational instances
- Automatic GCD reduction and sign normalization

**Class Methods**:
- `from_float(cls, f)` (L292-303): Exact float-to-fraction conversion
- `from_decimal(cls, dec)` (L306-315): Exact Decimal-to-fraction conversion  
- `_from_coprime_ints(cls, numerator, denominator)` (L318-327): Internal constructor for pre-reduced fractions

**Core Methods**:
- `limit_denominator(self, max_denominator=1000000)` (L340-395): Finds closest fraction with bounded denominator using continued fractions
- `is_integer(self)` (L329-331): Tests if denominator equals 1
- `as_integer_ratio(self)` (L333-338): Returns (numerator, denominator) tuple

#### Arithmetic Operations (L710-846)
Optimized rational arithmetic using GCD algorithms from Knuth TAOCP:

**Binary Operations**:
- `_add(a, b)` (L710-722): Addition with GCD optimization
- `_sub(a, b)` (L726-738): Subtraction with GCD optimization  
- `_mul(a, b)` (L742-754): Multiplication with cross-GCD reduction
- `_div(a, b)` (L758-776): Division with zero-check and sign handling
- `_floordiv`, `_divmod`, `_mod` (L780-799): Integer division operations

**Power Operations**:
- `__pow__(a, b)` (L801-831): Rational exponentiation for integer powers, float conversion for fractional powers
- `__rpow__(b, a)` (L833-845): Reverse power with type preservation

#### Formatting Support (L417-531)
Advanced `__format__` method supporting float-style format specifications (e, E, f, F, g, G, %). Uses helper functions:
- `_round_to_exponent(n, d, exponent)` (L74-100): Rounds to power-of-10 multiple
- `_round_to_figures(n, d, figures)` (L103-139): Rounds to significant figures

#### Comparison & Hashing (L912-975)
- `__eq__(a, b)` (L912-931): Equality with special float/complex handling
- `_richcmp(self, other, op)` (L933-953): Unified comparison helper
- `__hash__(self)` (L908-910): Uses cached `_hash_algorithm` for consistency with numeric types

### Helper Functions

#### Hash Algorithm (L24-55)
`_hash_algorithm(numerator, denominator)`: LRU-cached hash function ensuring `hash(Fraction(a,b)) == hash(float(a/b))` when numerically equal. Uses modular arithmetic with `_PyHASH_MODULUS`.

#### Operator Fallbacks (L533-640)
`_operator_fallbacks(monomorphic_operator, fallback_operator)`: Meta-function generating forward/reverse operators with mixed-type handling. Implements precedence rules for Fraction/int/float/complex interactions.

#### String Parsing (L57-69)
`_RATIONAL_FORMAT`: Complex regex supporting various input formats including decimals, fractions, scientific notation, and underscore separators in numbers.

### Dependencies & Patterns

**Key Imports**: `decimal.Decimal`, `functools`, `math`, `numbers`, `operator`, `re`, `sys`

**Design Patterns**:
- Immutable value object using `__new__` instead of `__init__`
- Automatic normalization (GCD reduction, positive denominator)
- Mixed-type arithmetic with fallback hierarchy
- Comprehensive format specification parsing
- Cache-optimized hash computation

**Critical Invariants**:
- Denominator always positive and non-zero
- Numerator and denominator always coprime (except during construction)
- Immutability maintained throughout object lifecycle