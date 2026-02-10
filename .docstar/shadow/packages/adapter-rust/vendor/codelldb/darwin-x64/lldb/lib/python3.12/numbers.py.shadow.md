# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/numbers.py
@source-hash: ac381960a3dc1db0
@generated: 2026-02-09T18:08:18Z

**Primary Purpose:**
Standard Python module implementing Abstract Base Classes (ABCs) for numeric types according to PEP 3141. Defines a hierarchical type system for numbers with increasing specificity: Number → Complex → Real → Rational → Integral.

**Class Hierarchy:**
- `Number` (L37-47): Root ABC for all numeric types, provides basic type checking capability
- `Complex` (L57-169): Defines complex number operations including arithmetic, real/imag properties, conjugation, and conversion to complex
- `Real` (L172-290): Extends Complex with real number operations like float conversion, truncation, floor/ceil, rounding, divmod, and comparison operators  
- `Rational` (L292-317): Adds numerator/denominator properties for rational numbers
- `Integral` (L319-418): Adds integer-specific operations like int conversion, bitwise operations, and modular exponentiation

**Key Abstract Methods:**
- `Complex.__complex__()` (L70-72): Required conversion to builtin complex type
- `Complex.real/imag` properties (L78-94): Access to real/imaginary components
- `Real.__float__()` (L183-188): Required conversion to float
- `Real.__trunc__()` (L190-201): Truncation toward zero
- `Rational.numerator/denominator` (L297-305): Fraction representation
- `Integral.__int__()` (L328-331): Required conversion to int

**Concrete Implementations:**
- `Real.__complex__()` (L271-273): Implements complex conversion for reals
- `Real.real/imag/conjugate` (L275-287): Implements complex interface for reals
- `Rational.__float__()` (L308-316): Converts via numerator/denominator division
- `Integral.numerator/denominator` (L408-416): Returns self/1 for integers

**Type Registration:**
- Registers builtin types: `complex` (L169), `float` (L289), `int` (L418)

**Architecture Notes:**
- Uses `__slots__ = ()` to prevent attribute assignment on ABC instances
- `Number.__hash__ = None` forces concrete types to implement their own hash
- Maintenance notes (L8-31) warn about API stability constraints for ABCs
- Decimal note (L49-55) explains why Decimal doesn't register as Real despite having Real methods

**Dependencies:**
- `abc.ABCMeta, abstractmethod` for ABC infrastructure
- No other external dependencies