# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/operator.py
@source-hash: b2af20f67667203c
@generated: 2026-02-09T18:08:24Z

## Primary Purpose
Pure Python implementation of the standard library `operator` module, providing functional equivalents to Python's built-in operators and special methods. This serves as a fallback when the C-based `_operator` module is unavailable.

## Key Components

### Comparison Operations (L27-49)
- `lt`, `le`, `eq`, `ne`, `ge`, `gt`: Functional equivalents to `<`, `<=`, `==`, `!=`, `>=`, `>`
- Direct operator delegation with minimal overhead

### Logical Operations (L53-67)
- `not_` (L53): Negation operator `not`
- `truth` (L57): Boolean conversion with explicit True/False return
- `is_`, `is_not` (L61-67): Identity comparison operators

### Mathematical/Bitwise Operations (L71-142)
- Arithmetic: `add`, `sub`, `mul`, `truediv`, `floordiv`, `mod`, `pow` (L75-138)
- Unary: `abs`, `neg`, `pos` (L71-122)
- Bitwise: `and_`, `or_`, `xor`, `lshift`, `rshift`, `inv`/`invert` (L79-142)
- Matrix multiplication: `matmul` (L108) for `@` operator
- Special: `index` (L87) calls `__index__()` method

### Sequence Operations (L146-222)
- `concat` (L146): Sequence concatenation with type checking
- `contains` (L153): Membership testing with reversed operands
- `countOf` (L157): Count occurrences using identity/equality
- Item access: `getitem`, `setitem`, `delitem` (L165-183)
- `indexOf` (L173): Find first occurrence index
- `length_hint` (L185): Estimate sequence length with comprehensive fallback logic

### Callable Objects (L232-334)
- `attrgetter` (L232): Extracts attributes, supports dotted names and multiple attrs
- `itemgetter` (L271): Extracts items by key/index, supports multiple keys
- `methodcaller` (L302): Calls methods with args/kwargs on target objects
All implement `__reduce__` for pickle support and optimized single/multiple item handling.

### In-place Operations (L339-410)
- All augmented assignment operators: `iadd`, `iand`, `iconcat`, etc.
- Return modified object after in-place operation
- `iconcat` (L349) includes sequence type validation

### Function Utilities
- `call` (L226): Function call wrapper accepting `*args, **kwargs`

## Architecture & Dependencies

### Module Structure
- Imports `abs` from builtins as `_abs` (L22) to avoid name collision
- Attempts C extension import (L413-418): `from _operator import *` with graceful fallback
- Establishes dunder method aliases (L422-467) for all operators after potential C import

### Critical Design Patterns
- Consistent docstring format: "Same as [operator expression]"
- Type validation for string parameters in callable classes
- Graceful error handling with descriptive TypeError messages
- Memory-efficient `__slots__` usage in callable classes
- Lazy function compilation in getter classes for performance

### Public API
Complete `__all__` export list (L13-20) covering all 39 public functions and classes.