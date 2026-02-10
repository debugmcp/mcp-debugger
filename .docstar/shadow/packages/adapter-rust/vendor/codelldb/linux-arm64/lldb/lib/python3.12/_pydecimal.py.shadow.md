# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/_pydecimal.py
@source-hash: f918a55369a8eede
@generated: 2026-02-09T18:08:37Z

## Python Decimal Arithmetic Module

Pure Python implementation of decimal floating-point arithmetic compliant with the IBM Decimal Arithmetic specification.

### Core Classes

**`Decimal` (L426-3757)**: Primary decimal number class with immutable instances. Stores values using `_sign` (0/1), `_int` (digit string), `_exp` (exponent), and `_is_special` (bool) slots. Supports construction from strings, integers, floats, tuples, and other Decimals.

Key methods include:
- Arithmetic: `__add__`, `__sub__`, `__mul__`, `__truediv__`, `__pow__` (L1070-2426)
- Comparisons: `__eq__`, `__lt__`, `__le__`, `__gt__`, `__ge__` with NaN handling (L794-836)
- Rounding functions: `_round_down`, `_round_up`, `_round_half_even`, etc. (L1676-1741)
- Special operations: `sqrt`, `exp`, `ln`, `log10` (L2641-3245)
- Formatting: `__format__` with PEP 3101 support (L3672-3756)

**`Context` (L3797-5540)**: Manages precision, rounding mode, exception handling, and bounds. Contains attributes like `prec`, `rounding`, `Emin`, `Emax`, `traps`, and `flags`. Provides arithmetic methods that delegate to Decimal operations.

**`_WorkRep` (L5542-5565)**: Internal working representation for calculations, converting between Decimal's string-based storage and integer arithmetic.

### Exception Hierarchy

Base class `DecimalException` (L95-116) with specific exceptions:
- `InvalidOperation` (L130-157): Invalid arithmetic operations, NaN creation
- `DivisionByZero` (L169-183): Division by zero handling
- `Overflow`/`Underflow` (L256-307): Range overflow/underflow with context-dependent results
- Signal exceptions: `Inexact`, `Rounded`, `Subnormal`, `Clamped` (L207-255)

### Context Management

Thread-local context system using `contextvars`:
- `getcontext()` (L351-363): Retrieves current thread context
- `setcontext()` (L365-370): Sets thread context
- `localcontext()` (L374-417): Context manager for temporary context changes

### Constants and Configuration

Rounding modes: `ROUND_DOWN`, `ROUND_HALF_UP`, `ROUND_HALF_EVEN`, etc. (L70-77)
Predefined contexts: `DefaultContext`, `BasicContext`, `ExtendedContext` (L6002-6027)
Platform-specific limits based on `sys.maxsize` (L82-91)

### Internal Arithmetic Functions

High-precision transcendental functions for `exp`, `ln`, `log10`, `pow`:
- `_dexp()` (L5852-5886): Decimal exponential approximation
- `_dlog()` (L5734-5776): Natural logarithm computation
- `_dpower()` (L5888-5928): Power function implementation
- `_ilog()` (L5652-5698): Integer logarithm approximation using Taylor series

### String Parsing and Formatting

Regex-based number parser `_parser` (L6045-6062) handles scientific notation, infinity, and NaN.
PEP 3101 formatting support with specifier parsing (L6076-6314) for various numeric formats.

### Utility Functions

- `_convert_other()` (L5941-5958): Handles implicit type conversion
- `_normalize()` (L5568-5594): Normalizes operands for arithmetic
- Helper functions for exact arithmetic and rounding