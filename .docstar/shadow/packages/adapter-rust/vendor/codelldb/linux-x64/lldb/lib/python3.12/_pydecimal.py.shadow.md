# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/_pydecimal.py
@source-hash: f918a55369a8eede
@generated: 2026-02-09T18:10:37Z

This is Python's `_pydecimal.py` - the pure Python implementation of the `decimal` module providing arbitrary precision decimal arithmetic according to the IEEE 754 decimal standard.

## Core Classes

**Decimal (L426-3758)** - The main decimal number class with arbitrary precision arithmetic
- `__slots__`: `_exp`, `_int`, `_sign`, `_is_special` (L429)
- Constructor handles strings, ints, floats, tuples, and other Decimals (L435-583)
- Arithmetic operations: `__add__` (L1070), `__sub__` (L1158), `__mul__` (L1180), `__truediv__` (L1237), `__pow__` (L2212)
- Comparison methods: `__eq__` (L794), `__lt__` (L802), `__le__` (L811), `__gt__` (L820), `__ge__` (L829)
- Special methods: `__hash__` (L856), `__str__` (L944), `__repr__` (L939), `__format__` (L3672)
- Mathematical functions: `sqrt` (L2641), `ln` (L3116), `log10` (L3196), `exp` (L2960)
- Utility methods: `normalize` (L2435), `quantize` (L2460), `to_integral_value` (L2622)

**Context (L3797-4540)** - Controls precision, rounding, and error handling for decimal operations
- Key attributes: `prec`, `rounding`, `Emin`, `Emax`, `capitals`, `clamp`, `flags`, `traps` (L3816-3832)
- Methods mirror Decimal operations but with explicit context control
- Context managers via `_ContextManager` (L3782-3795)

## Exception Hierarchy

**DecimalException (L95-116)** - Base class for all decimal-specific exceptions
- **Clamped (L118-128)** - Exponent altered to fit representation bounds
- **InvalidOperation (L130-157)** - Invalid mathematical operation
- **DivisionByZero (L169-183)** - Division by zero
- **Inexact (L207-217)** - Result required rounding
- **Rounded (L233-243)** - Result was rounded
- **Overflow (L256-291)** - Result too large for representation
- **Underflow (L294-307)** - Result too small, rounded to zero
- **Subnormal (L245-254)** - Subnormal result
- **FloatOperation (L309-322)** - Mixed float/decimal operation

## Key Functions

**Context Management (L351-417)**
- `getcontext()` (L351) - Get current thread's context
- `setcontext()` (L365) - Set current thread's context  
- `localcontext()` (L374) - Context manager for temporary context changes

**Helper Functions**
- `_dec_from_triple()` (L3758) - Create Decimal from sign/coefficient/exponent
- `_convert_other()` (L5941) - Convert other types to Decimal
- `_WorkRep` (L5542) - Internal representation for arithmetic operations

## Constants and Configuration

**Rounding Modes (L69-77)**
- `ROUND_DOWN`, `ROUND_HALF_UP`, `ROUND_HALF_EVEN`, `ROUND_CEILING`, etc.

**Predefined Contexts (L6002-6027)**
- `DefaultContext` - 28 digit precision, ROUND_HALF_EVEN
- `BasicContext` - 9 digit precision with most traps enabled
- `ExtendedContext` - 9 digit precision with no traps

**Platform Limits (L82-91)**
- `MAX_PREC`, `MAX_EMAX`, `MIN_EMIN` - Platform-dependent precision limits

## Arithmetic Implementation

The module implements decimal arithmetic using string-based coefficient storage for efficiency. Key algorithms include:
- Normalized addition/subtraction via `_normalize()` (L5568)
- Exact power computation via `_power_exact()` (L1964) 
- Transcendental functions using Taylor series and argument reduction
- IEEE 754 compliant rounding and exception handling

## Format Support

Full PEP 3101 format specification support in `__format__()` including scientific notation, engineering notation, percentage formatting, and locale-aware number formatting via `_parse_format_specifier()` (L6102) and related functions.

The implementation maintains strict compatibility with the IBM General Decimal Arithmetic Specification and provides both C-extension compatibility constants (`HAVE_THREADS`, `HAVE_CONTEXTVAR`) and the complete decimal arithmetic semantics required by the Python standard library.