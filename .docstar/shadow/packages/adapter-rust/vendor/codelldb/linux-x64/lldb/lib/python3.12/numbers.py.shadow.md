# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/numbers.py
@source-hash: ac381960a3dc1db0
@generated: 2026-02-09T18:09:53Z

This module provides Abstract Base Classes (ABCs) for numeric types according to PEP 3141, forming a hierarchical tower of number abstractions used for type checking and polymorphism.

## Architecture & Design
The module implements a hierarchical number tower: `Number` → `Complex` → `Real` → `Rational` → `Integral`, where each level adds specific capabilities while inheriting from more general types above it.

## Key Classes

### Number (L37-47)
Root ABC for all numeric types. Provides basic `isinstance()` checking capability with `__hash__ = None` to force concrete implementations to define their own hash methods.

### Complex (L57-169)
Extends Number with complex number operations. Defines abstract methods for:
- Conversion: `__complex__()` (L71-72)
- Components: `real` and `imag` properties (L80-94) 
- Arithmetic: `__add__`, `__mul__`, `__truediv__`, `__pow__` etc. with both forward and reverse variants
- Special: `conjugate()` (L160-162), `__abs__()` (L155-157)

Provides concrete implementations for `__bool__()` (L74-76) and subtraction operations (L116-122) built from addition and negation. Registers builtin `complex` type (L169).

### Real (L172-289)
Extends Complex for real numbers, adding:
- Conversion: `__float__()` (L184-188)
- Rounding: `__trunc__()`, `__floor__()`, `__ceil__()`, `__round__()` (L191-220)
- Integer division: `__floordiv__()`, `__mod__()` with concrete `__divmod__()` implementations (L222-256)
- Comparisons: `__lt__()`, `__le__()` (L259-268)

Provides concrete Complex method implementations: `__complex__()` via float conversion (L271-273), `real`/`imag` properties (L276-283), and no-op `conjugate()` (L285-287). Registers builtin `float` type (L289).

### Rational (L292-317)
Extends Real with fraction representation requiring abstract `numerator` and `denominator` properties (L299-305). Provides concrete `__float__()` using integer division to avoid overflow (L308-316).

### Integral (L319-418)
Extends Rational with integer-specific operations:
- Conversion: `__int__()` (L329-331), `__index__()` (L333-335)
- Modular arithmetic: 3-argument `__pow__()` (L338-346)
- Bitwise operations: shift (`__lshift__`, `__rshift__`), logical (`__and__`, `__xor__`, `__or__`), and `__invert__()` (L349-401)

Provides concrete implementations: `__float__()` via int conversion (L404-406), `numerator` as self (L409-411), `denominator` as 1 (L414-416). Registers builtin `int` type (L418).

## Dependencies
- `abc.ABCMeta, abstractmethod` for ABC infrastructure
- Built-in numeric types: `complex`, `float`, `int` are registered with their respective ABCs

## Design Patterns
- Abstract Base Class pattern with registration of concrete builtin types
- Template Method pattern where abstract operations are combined into concrete default implementations
- Mixin inheritance where higher-level ABCs provide concrete implementations of lower-level abstract methods

## Critical Constraints
- Maintenance notes (L8-31) warn that published ABCs cannot have methods added without breaking compatibility
- Decimal types intentionally excluded from Real registration due to lack of binary float interoperability (L49-55)
- All classes use `__slots__ = ()` for memory efficiency