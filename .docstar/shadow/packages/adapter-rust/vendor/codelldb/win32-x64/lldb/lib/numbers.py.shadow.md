# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/numbers.py
@source-hash: ac381960a3dc1db0
@generated: 2026-02-09T18:13:21Z

## Purpose
Implements Python's numeric tower Abstract Base Classes (ABCs) according to PEP 3141, defining hierarchical interfaces for Number → Complex → Real → Rational → Integral types. Used for type checking and ensuring numeric type compliance across Python's standard library.

## Key Classes

### Number (L37-46)
Root ABC for all numeric types. Defines minimal interface with `__hash__ = None` requiring concrete implementations to provide their own hash methods. Used for `isinstance(x, Number)` checks.

### Complex (L57-169) 
Extends Number, defines complex number operations interface. Key abstract methods:
- `__complex__()` (L71): conversion to builtin complex
- `real`, `imag` properties (L80, L89): component access  
- Arithmetic: `__add__`, `__mul__`, `__truediv__`, `__pow__` etc. (L97-152)
- `conjugate()` (L160): complex conjugation
- `__abs__()` (L155): magnitude calculation

Provides concrete `__bool__()` (L74) and subtraction methods (L116-122). Registers builtin `complex` type (L169).

### Real (L172-289)
Extends Complex for real number operations. Key abstract methods:
- `__float__()` (L184): conversion to float
- Rounding: `__trunc__`, `__floor__`, `__ceil__`, `__round__` (L191-220)
- Floor division/modulus: `__floordiv__`, `__mod__` (L239-256) 
- Comparisons: `__lt__`, `__le__` (L259-268)

Provides concrete implementations of Complex methods (L271-287) and `__divmod__` operations (L222-236). Registers builtin `float` type (L289).

### Rational (L292-317)
Extends Real, adds fraction representation via abstract `numerator`/`denominator` properties (L299-305). Provides concrete `__float__()` implementation using integer division (L308-316) to avoid overflow issues.

### Integral (L319-418)
Extends Rational for integer operations. Key abstract methods:
- `__int__()` (L329): integer conversion
- `__pow__()` with optional modulus (L338): supports 3-argument pow()
- Bitwise operations: shift, and, or, xor, invert (L349-401)

Provides concrete `__index__()` (L333), `__float__()` (L404), and rational properties (L409-416). Registers builtin `int` type (L418).

## Architecture Notes
- Strict hierarchy: each level adds operations while maintaining parent contracts
- Uses ABCMeta for abstract method enforcement
- Registers corresponding builtin types (complex, float, int) for isinstance() compatibility
- Extensive maintenance notes (L8-31) warn against modifying published ABCs
- Decimal deliberately not registered with Real due to interoperability concerns (L49-55)