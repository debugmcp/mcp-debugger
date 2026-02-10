# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/operator.py
@source-hash: b2af20f67667203c
@generated: 2026-02-09T18:14:31Z

## Pure Python implementation of the operator module

**Primary Purpose:** Provides functional interfaces to Python's intrinsic operators and special methods, serving as a fallback implementation when the C-based `_operator` module is unavailable.

### Core Categories

**Comparison Operations (L27-49)**
- `lt`, `le`, `eq`, `ne`, `ge`, `gt`: Direct wrappers for comparison operators (`<`, `<=`, `==`, `!=`, `>=`, `>`)

**Logical Operations (L53-67)**
- `not_(a)` (L53): Negation operator wrapper
- `truth(a)` (L57): Boolean conversion with explicit True/False return
- `is_`, `is_not`: Identity comparison operators

**Mathematical/Bitwise Operations (L71-142)**
- Arithmetic: `add`, `sub`, `mul`, `truediv`, `floordiv`, `mod`, `pow`, `matmul` (matrix multiplication)
- Unary: `abs` (L71, uses imported `_abs`), `neg`, `pos`
- Bitwise: `and_`, `or_`, `xor`, `lshift`, `rshift`, `inv`/`invert` (L91-94, `invert` is alias for `inv`)
- Special: `index(a)` (L87) - calls `a.__index__()`

**Sequence Operations (L146-222)**
- `concat(a, b)` (L146): Sequence concatenation with type checking
- `contains(a, b)` (L153): Membership test with reversed operands (`b in a`)
- `countOf(a, b)` (L157): Count occurrences using identity/equality check
- Item access: `getitem`, `setitem`, `delitem`
- `indexOf(a, b)` (L173): Find first index with identity/equality check
- `length_hint(obj, default=0)` (L185): Estimate sequence length with fallback logic

**Callable Utilities**
- `call(obj, /, *args, **kwargs)` (L226): Function call wrapper with positional-only first parameter

### Key Classes

**attrgetter (L232-269)**
- Extracts attributes from objects, supports dot notation for nested attributes
- Single attribute: creates direct accessor function
- Multiple attributes: returns tuple of values
- Uses recursive `attrgetter` instances for multiple attributes (L255)

**itemgetter (L271-300)**
- Extracts items by index/key from subscriptable objects  
- Single item: direct `obj[item]` access
- Multiple items: returns tuple of extracted values

**methodcaller (L302-334)**
- Calls named method on objects with stored arguments and keyword arguments
- Validates method name is string (L313)
- Complex `__reduce__` implementation using `functools.partial` for kwargs (L329-334)

**In-place Operations (L339-410)**
- All augmented assignment operators: `iadd`, `iand`, `iconcat`, `ifloordiv`, etc.
- Pattern: perform in-place operation and return modified object
- `iconcat` (L349) includes same type checking as `concat`

### Module Integration

**C Extension Fallback (L413-418)**
- Attempts to import from `_operator` C module
- Gracefully handles ImportError for pure Python fallback
- Imports `__doc__` from C module if available

**Dunder Method Aliases (L420-467)**
- Creates `__method__` aliases for all functions after potential C import
- Ensures compatibility with Python's operator protocol
- Critical for integration with Python's internal operator dispatch

### Architecture Notes

- **Explicit exports**: `__all__` (L13-20) carefully controls public API
- **Type safety**: Functions like `concat`/`iconcat` validate operand types
- **Identity vs equality**: `countOf` and `indexOf` check both `is` and `==`
- **Graceful degradation**: Multiple fallback strategies in `length_hint`
- **Memory optimization**: Classes use `__slots__` to reduce memory overhead