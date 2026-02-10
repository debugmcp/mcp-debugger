# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/operator.py
@source-hash: b2af20f67667203c
@generated: 2026-02-09T18:09:03Z

## Purpose and Responsibility

Pure Python implementation of the `operator` module, providing functional equivalents of Python's intrinsic operators. This module is part of Python's standard library and is included in the LLDB debugging environment within the Rust adapter.

## Key Functions and Classes

### Comparison Operations (L27-49)
- `lt(a, b)` (L27), `le(a, b)` (L31), `eq(a, b)` (L35), `ne(a, b)` (L39), `ge(a, b)` (L43), `gt(a, b)` (L47): Functional equivalents of `<`, `<=`, `==`, `!=`, `>=`, `>`

### Logical Operations (L53-67)
- `not_(a)` (L53): Equivalent to `not a`
- `truth(a)` (L57): Returns boolean conversion of `a`
- `is_(a, b)` (L61), `is_not(a, b)` (L65): Equivalent to `is` and `is not` operators

### Mathematical/Bitwise Operations (L71-142)
- Arithmetic: `add(a, b)` (L75), `sub(a, b)` (L132), `mul(a, b)` (L104), `truediv(a, b)` (L136), `floordiv(a, b)` (L83), `mod(a, b)` (L100), `pow(a, b)` (L124)
- Bitwise: `and_(a, b)` (L79), `or_(a, b)` (L116), `xor(a, b)` (L140), `lshift(a, b)` (L96), `rshift(a, b)` (L128)
- Unary: `abs(a)` (L71), `neg(a)` (L112), `pos(a)` (L120), `inv(a)` (L91) with alias `invert` (L94)
- Special: `matmul(a, b)` (L108) for matrix multiplication (`@`), `index(a)` (L87) for `.__index__()`

### Sequence Operations (L146-222)
- `concat(a, b)` (L146): Sequence concatenation with type checking
- `contains(a, b)` (L153): Membership test (`b in a`) with reversed operands
- `countOf(a, b)` (L157), `indexOf(a, b)` (L173): Count/find items in sequence
- `delitem(a, b)` (L165), `getitem(a, b)` (L169), `setitem(a, b, c)` (L181): Item access operations
- `length_hint(obj, default=0)` (L185): Estimate object length with fallback to `__length_hint__`

### Other Operations
- `call(obj, /, *args, **kwargs)` (L226): Function call operator

### Callable Classes (L232-334)
- `attrgetter(attr, *attrs)` (L232): Creates callable for attribute access, supports nested attributes via dot notation
- `itemgetter(item, *items)` (L271): Creates callable for item access, supports multiple items
- `methodcaller(name, /, *args, **kwargs)` (L302): Creates callable for method invocation with arguments

### In-place Operations (L339-410)
Complete set of augmented assignment operators: `iadd`, `iand`, `iconcat`, `ifloordiv`, `ilshift`, `imod`, `imul`, `imatmul`, `ior`, `ipow`, `irshift`, `isub`, `itruediv`, `ixor`

## Dependencies and Relationships

- Imports `abs` from `builtins` as `_abs` (L22) to avoid name collision
- Attempts to import from C extension `_operator` (L414-418) for performance, falls back to pure Python
- Sets `__dunder__` aliases (L422-467) for all functions to match operator protocol

## Architectural Patterns

- **Functional Interface**: All operators exposed as standalone functions
- **Fallback Strategy**: C extension preferred, pure Python as backup
- **Dual Naming**: Both operator names (`add`) and dunder equivalents (`__add__`)
- **Callable Factories**: `attrgetter`, `itemgetter`, `methodcaller` use closure-based optimization
- **Type Validation**: Input validation in key functions (e.g., string checks in `attrgetter`, `methodcaller`)

## Critical Invariants

- In-place operations modify first argument and return it
- `contains(a, b)` has reversed operand order compared to `in` operator
- `concat`/`iconcat` require sequence-like objects (check for `__getitem__`)
- `length_hint` returns non-negative integers or raises appropriate errors
- All callable classes implement `__reduce__` for pickling support