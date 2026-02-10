# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/fractions.py
@source-hash: d52d1ab9d5be2692
@generated: 2026-02-09T18:07:47Z

## Fraction Module - Infinite Precision Rational Numbers

**Primary Purpose:** Implements the `Fraction` class for exact rational number arithmetic with infinite precision. Part of Python's standard library for mathematical computations requiring exact fractional representation.

### Key Components

**Core Class:**
- `Fraction` (L162-990): Main class implementing `numbers.Rational` interface with immutable `__slots__` design (`_numerator`, `_denominator`)

**Construction Methods:**
- `__new__` (L186-289): Primary constructor supporting integers, strings, floats, Decimals, and other Rationals
- `from_float` (L292-303): Class method for exact float-to-fraction conversion
- `from_decimal` (L306-315): Class method for exact Decimal-to-fraction conversion  
- `_from_coprime_ints` (L318-327): Internal constructor for pre-normalized numerator/denominator pairs

**Core Operations:**
- Arithmetic operators (L724-799): `+`, `-`, `*`, `/`, `//`, `%`, `divmod` with optimized GCD-based algorithms
- Power operations (L801-845): `__pow__`, `__rpow__` handling integer and fractional exponents
- Comparison operators (L955-969): `<`, `>`, `<=`, `>=` using cross-multiplication
- Unary operators (L847-880): `+`, `-`, `abs`, `int`, `trunc`, `floor`, `ceil`

**Key Utility Functions:**
- `_hash_algorithm` (L25-55): LRU-cached hash computation ensuring consistency with numeric types
- `_round_to_exponent` (L74-100): Rounds rational to nearest power of 10 multiple
- `_round_to_figures` (L103-139): Rounds to specified significant figures
- `_operator_fallbacks` (L533-640): Generates forward/reverse operators with type coercion

**String Formatting:**
- `__format__` (L417-531): Comprehensive float-style formatting supporting scientific notation, precision, alignment
- Regex pattern `_RATIONAL_FORMAT` (L57-69): Parses string representations of fractions and decimals
- Format specification matcher (L144-159): Validates and parses format strings

**Properties & Methods:**
- `numerator`/`denominator` properties (L398-403): Access to normalized components
- `limit_denominator` (L340-395): Finds closest fraction with bounded denominator using continued fractions
- `is_integer` (L329-331): Checks if fraction represents whole number
- `as_integer_ratio` (L333-338): Returns (numerator, denominator) tuple

### Architecture Notes

**Normalization Strategy:** All fractions automatically reduced to lowest terms via GCD, with positive denominators enforced.

**Hash Consistency:** Uses modular arithmetic with `_PyHASH_MODULUS` to ensure `hash(Fraction(a, b)) == hash(float(a/b))` when equal.

**Arithmetic Optimization:** Implements Knuth's algorithms (TAOCP Vol 2, 4.5.1) with GCD pre-computation to minimize intermediate value sizes.

**Type Coercion:** Sophisticated fallback system handles mixed-type operations, deferring to other types when appropriate via `NotImplemented`.

**Immutability:** Uses `__new__` instead of `__init__` and `__slots__` for memory efficiency and thread safety.

### Dependencies
- `math` (GCD operations), `numbers` (ABC interfaces), `decimal` (Decimal conversion)  
- `operator` (fallback operations), `re` (string parsing), `functools` (LRU cache)