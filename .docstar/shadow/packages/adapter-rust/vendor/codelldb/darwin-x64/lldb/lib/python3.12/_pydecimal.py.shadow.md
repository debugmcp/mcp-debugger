# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/_pydecimal.py
@source-hash: f918a55369a8eede
@generated: 2026-02-09T18:07:41Z

## Python Decimal Arithmetic Module (_pydecimal.py)

Pure Python implementation of IBM General Decimal Arithmetic specification for high-precision decimal arithmetic. This is the fallback implementation when the C extension module is unavailable.

### Core Classes

**Decimal (L426-3669)**: Main decimal number class providing arbitrary-precision decimal arithmetic
- Immutable decimal number representation using `_sign`, `_int`, `_exp`, `_is_special` slots (L429)
- Constructor handles strings, integers, floats, tuples, and other Decimals (L435-583)
- Complete arithmetic operations: `__add__` (L1070), `__sub__` (L1158), `__mul__` (L1180), `__truediv__` (L1237), `__pow__` (L2212)
- Comparison operations with proper NaN handling (L794-836)
- Rounding methods using configurable rounding modes (L1676-1741)
- Mathematical functions: `sqrt` (L2641), `ln` (L3116), `log10` (L3196), `exp` (L2960)
- String formatting with PEP 3101 support (L3672-3756)

**Context (L3797-5541)**: Arithmetic context controlling precision, rounding, and exception handling
- Configurable precision, rounding mode, min/max exponents (L3816-3851)
- Exception trapping and flag management (L3952-3990)
- Context manager support via `_ContextManager` (L3782-3795)
- All decimal operations available as context methods (L4057-5540)

### Exception Hierarchy

**DecimalException (L95-116)**: Base exception class for all decimal-specific exceptions
- Specialized exceptions: `InvalidOperation` (L130), `DivisionByZero` (L169), `Overflow` (L256), `Underflow` (L294)
- Each exception has custom `handle` methods for default behavior when not trapped

### Key Functions

**Context Management (L351-417)**:
- `getcontext()` (L351): Get thread-local context using contextvars
- `setcontext()` (L365): Set thread-local context 
- `localcontext()` (L374): Context manager for temporary context changes

**String Parsing (L6044-6062)**: Regex-based parser for decimal string format supporting scientific notation, infinity, and NaN

**Internal Arithmetic (L5596-5928)**: Helper functions for logarithms, exponentials, and power operations using integer arithmetic for precision

### Constants and Configuration

**Rounding Modes (L70-77)**: Eight rounding modes including `ROUND_HALF_EVEN`, `ROUND_UP`, `ROUND_DOWN`

**Default Contexts (L6002-6027)**:
- `DefaultContext`: 28-digit precision, standard traps
- `BasicContext`: 9-digit precision, all traps enabled
- `ExtendedContext`: 9-digit precision, no traps

**Compatibility Constants (L80-91)**: Platform-dependent precision and exponent limits

### Architecture Notes

- Uses string-based coefficient storage for performance (L450-456)
- Thread-safe context management via contextvars (L343-345)
- Extensive error handling with configurable exception trapping
- Full compatibility with IBM decimal arithmetic specification
- Fallback implementation maintaining identical API to C extension