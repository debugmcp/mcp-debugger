# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/numbers.py
@source-hash: ac381960a3dc1db0
@generated: 2026-02-09T18:07:18Z

## Primary Purpose
Python's numbers module defines Abstract Base Classes (ABCs) for the numeric tower per PEP 3141. Establishes inheritance hierarchy: Number → Complex → Real → Rational → Integral, where each level adds more specific numeric operations while maintaining backward compatibility.

## Class Hierarchy

### Number (L37-47)
Root ABC for all numeric types. Minimal interface with disabled hashing (`__hash__ = None`). Primary use: `isinstance(x, Number)` type checking.

### Complex (L57-169)
Defines complex number operations. Key abstract methods:
- Conversion: `__complex__()` (L71-72)
- Properties: `real` (L79-85), `imag` (L88-94) 
- Arithmetic: `__add__`, `__radd__`, `__neg__`, `__pos__`, `__mul__`, `__rmul__`, `__truediv__`, `__rtruediv__`, `__pow__`, `__rpow__` (L96-152)
- Special: `__abs__` (L155-157), `conjugate()` (L160-162), `__eq__` (L165-167)

Provides concrete implementations for subtraction (`__sub__`, `__rsub__`) via addition/negation. Registers built-in `complex` type (L169).

### Real (L172-290)
Extends Complex with real number operations. Key abstract methods:
- Conversions: `__float__()` (L184-188), `__trunc__()` (L191-201)
- Rounding: `__floor__()` (L204-206), `__ceil__()` (L209-211), `__round__()` (L214-220)
- Division: `__floordiv__`, `__rfloordiv__`, `__mod__`, `__rmod__` (L239-256)
- Comparison: `__lt__`, `__le__` (L259-268)

Provides concrete Complex implementations: `__complex__()` (L271-273), `real`/`imag` properties (L276-283), `conjugate()` (L285-287). Concrete `__divmod__`/`__rdivmod__` implementations (L222-236). Registers built-in `float` type (L289).

### Rational (L292-317)
Adds fraction representation via abstract `numerator`/`denominator` properties (L298-305). Provides concrete `__float__()` using integer division to avoid overflow (L308-316).

### Integral (L319-418)
Completes numeric tower with integer-specific operations:
- Conversion: `__int__()` (L329-331), `__index__()` (L333-335)
- Modular arithmetic: `__pow__(exponent, modulus=None)` (L338-346)
- Bitwise operations: `__lshift__`, `__rshift__`, `__and__`, `__xor__`, `__or__`, `__invert__` plus reverse variants (L349-401)

Provides concrete implementations for parent classes: `__float__()` (L404-406), `numerator`/`denominator` properties (L409-416). Registers built-in `int` type (L418).

## Key Dependencies
- `abc.ABCMeta, abstractmethod` (L33) for ABC infrastructure
- Built-in type registration: `complex`, `float`, `int`

## Critical Design Notes
- **Immutable API Contract**: Once published, ABCs cannot add new methods due to isinstance() compliance requirements (maintenance notes L8-31)
- **Decimal Exclusion**: Decimal types intentionally not registered as Real due to non-interoperability with binary floats (L49-55)
- **Method Signature Flexibility**: Optional parameters can be added without breaking isinstance() (L25-28)
- **Fallback Strategy**: Complex operations should fall back to built-in types for unknown operands (L63-65)