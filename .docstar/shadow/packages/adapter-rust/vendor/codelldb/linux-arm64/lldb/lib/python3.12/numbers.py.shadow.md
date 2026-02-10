# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/numbers.py
@source-hash: ac381960a3dc1db0
@generated: 2026-02-09T18:08:59Z

## Primary Purpose
Defines Abstract Base Classes (ABCs) for Python's numeric tower according to PEP 3141, establishing a hierarchy of number types from most general (Number) to most specific (Integral). Provides type checking capabilities and contracts for numeric operations.

## Key Classes

### Number (L37-46)
Root ABC for all numeric types. Serves as base class for `isinstance(x, Number)` checks. Sets `__hash__ = None` requiring concrete implementations to provide hash methods.

### Complex (L57-168)  
Extends Number with complex number operations. Defines abstract methods for:
- Conversion: `__complex__()` (L70-72)
- Properties: `real`, `imag` (L78-94) 
- Arithmetic: `__add__`, `__radd__`, `__neg__`, `__pos__`, `__mul__`, `__rmul__`, `__truediv__`, `__rtruediv__`, `__pow__`, `__rpow__` (L96-152)
- Other ops: `__abs__`, `conjugate`, `__eq__` (L154-167)

Provides concrete implementations for `__sub__`, `__rsub__` (L116-122) and `__bool__` (L74-76).
Registers builtin `complex` type (L169).

### Real (L172-289)
Extends Complex for real numbers. Adds abstract methods for:
- Conversion: `__float__` (L183-188)
- Rounding: `__trunc__`, `__floor__`, `__ceil__`, `__round__` (L190-220)
- Division ops: `__floordiv__`, `__rfloordiv__`, `__mod__`, `__rmod__` (L238-256)
- Comparison: `__lt__`, `__le__` (L258-268)

Provides concrete `__divmod__`, `__rdivmod__` (L222-236) and implements Complex abstracts: `__complex__`, `real`, `imag`, `conjugate` (L270-287).
Registers builtin `float` type (L289).

### Rational (L292-316)
Extends Real with fraction representation via abstract properties `numerator`, `denominator` (L297-305). Implements `__float__` using integer division to avoid overflow (L308-316).

### Integral (L319-417)
Extends Rational for integer types. Adds abstract methods for:
- Conversion: `__int__` (L328-331), plus concrete `__index__` (L333-335)
- Modular arithmetic: `__pow__` with modulus support (L337-346)
- Bitwise ops: shift (`__lshift__`, `__rlshift__`, `__rshift__`, `__rrshift__`), logical (`__and__`, `__rand__`, `__xor__`, `__rxor__`, `__or__`, `__ror__`), complement (`__invert__`) (L348-401)

Implements parent abstracts: `__float__`, `numerator`, `denominator` (L404-416).
Registers builtin `int` type (L418).

## Architecture Notes
- Hierarchical design: Number → Complex → Real → Rational → Integral
- Each level adds operations appropriate to that abstraction level
- Concrete types register with appropriate ABC level
- Maintenance comments (L8-31) warn about API stability constraints for ABCs

## Dependencies
- `abc.ABCMeta`, `abc.abstractmethod` for ABC infrastructure
- Builtin types: `complex`, `float`, `int` registered with respective ABCs

## Critical Constraints
- ABC API cannot be extended without breaking isinstance() contracts
- Decimal deliberately excluded from Real registration due to interoperability issues (L49-55)
- Hash methods must be provided by concrete implementations