# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/_pydecimal.py
@source-hash: f918a55369a8eede
@generated: 2026-02-09T18:07:18Z

## Pure Python Decimal Arithmetic Module

**Primary Purpose:** Python pure-Python implementation of decimal floating point arithmetic conforming to IBM's General Decimal Arithmetic Specification. This is part of an LLDB debugging environment and provides exact decimal arithmetic avoiding binary floating point representation errors.

### Core Classes

**Decimal (L426-3758):** Main decimal number class representing arbitrary-precision decimal numbers
- `__slots__`: `_exp`, `_int`, `_sign`, `_is_special` for memory efficiency
- Constructor supports strings, ints, floats, tuples, and other Decimals
- Internal representation: `(-1)**_sign * _int * 10**_exp` for finite numbers
- Special values: infinity ('F'), quiet NaN ('n'), signaling NaN ('N')

**Context (L3797-5540):** Configuration class controlling decimal arithmetic behavior
- Properties: precision (`prec`), rounding mode, exponent limits (`Emin`/`Emax`), traps, flags
- Methods for creating decimals with specific context settings
- Flag/trap management for exception handling

**_ContextManager (L3782-3795):** Context manager for `localcontext()` functionality

**_WorkRep (L5542-5564):** Internal working representation for arithmetic operations

### Key Decimal Methods

**Arithmetic Operations:**
- `__add__` (L1070), `__sub__` (L1158), `__mul__` (L1180), `__truediv__` (L1237)
- `__pow__` (L2212) with optional modulo parameter
- `__divmod__` (L1336), `__mod__` (L1379), `__floordiv__` (L1488)

**Comparison Methods:**
- Rich comparisons: `__eq__` (L794), `__lt__` (L802), etc.
- `compare()` (L838) returns Decimal(-1/0/1)
- `_cmp()` (L730) internal comparison for non-NaN decimals

**Conversion Methods:**
- `__str__` (L944), `__repr__` (L939), `__format__` (L3672)
- `__float__` (L1523), `__int__` (L1533)
- `from_float()` (L585) class method for exact float conversion

**Mathematical Functions:**
- `sqrt()` (L2641), `exp()` (L2960), `ln()` (L3116), `log10()` (L3196)
- `normalize()` (L2435), `quantize()` (L2460)
- Trigonometric and logical operations

### Exception Hierarchy

**Base Exception:** `DecimalException` (L95) extends `ArithmeticError`

**Specific Exceptions:**
- `InvalidOperation` (L130), `DivisionByZero` (L169), `Overflow` (L256), `Underflow` (L294)
- `Inexact` (L207), `Rounded` (L233), `Subnormal` (L245), `Clamped` (L118)
- `FloatOperation` (L309) for strict float/decimal mixing control

### Context Management Functions

**Global Context Functions (L351-417):**
- `getcontext()` (L351): Retrieves current thread-local context
- `setcontext()` (L365): Sets thread-local context  
- `localcontext()` (L374): Context manager for temporary context changes

Uses `contextvars.ContextVar` for thread-local storage.

### Constants and Configuration

**Rounding Modes (L69-77):** String constants like `ROUND_HALF_EVEN`, `ROUND_UP`, etc.

**Predefined Contexts:**
- `DefaultContext` (L6002): 28-digit precision, ROUND_HALF_EVEN
- `BasicContext` (L6017): 9-digit precision, ROUND_HALF_UP  
- `ExtendedContext` (L6023): 9-digit precision, no traps

**Platform Limits (L82-91):** `MAX_PREC`, `MAX_EMAX`, `MIN_EMIN` based on system architecture

### Internal Utilities

**String Parsing (L6044-6062):** Regex parser for decimal string format with sign, digits, exponent, infinity, NaN support

**Mathematical Helper Functions:**
- `_ilog()` (L5652): Integer logarithm approximation
- `_dexp()` (L5852): Decimal exponential function
- `_dpower()` (L5888): Decimal power function
- `_sqrt_nearest()` (L5621): Integer square root

**Format Support (L6076-6314):** PEP 3101 format specifier parsing and formatting with locale support

### Architecture Notes

- Uses string representation internally for coefficient (`_int`) to optimize digit operations
- Implements IBM General Decimal Arithmetic Specification
- Thread-safe context management via contextvars
- Extensive rounding mode support with exact decimal arithmetic
- Compatible with Python's numeric tower (registers as `numbers.Number` but not `numbers.Real`)