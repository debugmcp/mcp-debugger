# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/operator.py
@source-hash: b2af20f67667203c
@generated: 2026-02-09T18:07:19Z

## Primary Purpose
Pure Python implementation of the `operator` module providing functional equivalents to Python's intrinsic operators and special methods. Serves as fallback when the C implementation `_operator` is unavailable.

## Key Components

### Comparison Operations (L25-49)
- `lt`, `le`, `eq`, `ne`, `ge`, `gt`: Direct wrappers for comparison operators (<, <=, ==, !=, >=, >)
- Simple two-parameter functions returning boolean results

### Logical Operations (L51-67)
- `not_(a)` (L53): Logical negation equivalent to `not a`
- `truth(a)` (L57): Boolean conversion with explicit True/False return
- `is_(a, b)`, `is_not(a, b)` (L61, L65): Identity comparison operators

### Mathematical/Bitwise Operations (L69-142)
- Arithmetic: `add`, `sub`, `mul`, `truediv`, `floordiv`, `mod`, `pow` (L75-137)
- Bitwise: `and_`, `or_`, `xor`, `lshift`, `rshift`, `inv`/`invert` (L79-142)
- Unary: `abs`, `neg`, `pos` (L71-122)
- Special: `matmul` for matrix multiplication `@`, `index` for `__index__()` (L108, L87)

### Sequence Operations (L144-222)
- `concat(a, b)` (L146): Sequence concatenation with type checking via `__getitem__`
- `contains(a, b)` (L153): Membership testing with reversed operands (b in a)
- `countOf(a, b)` (L157): Count occurrences using identity or equality
- `indexOf(a, b)` (L173): Find first index with identity/equality fallback
- Item access: `getitem`, `setitem`, `delitem` (L169-183)
- `length_hint(obj, default=0)` (L185): Robust length estimation with `__length_hint__` protocol support

### Callable Utility Classes

#### `attrgetter` (L232-270)
- Generates callable objects for attribute access with dot-notation support
- Single attr: returns direct value, multiple attrs: returns tuple
- Uses `__slots__` for memory efficiency
- Supports nested attributes via dot separation (e.g., 'name.first')

#### `itemgetter` (L271-301) 
- Creates callable objects for item access via `[]` operator
- Single item: returns direct value, multiple items: returns tuple
- Memory-optimized with `__slots__`

#### `methodcaller` (L302-335)
- Generates callable objects that invoke methods with arguments
- Supports both positional and keyword arguments
- Special `__reduce__` handling for kwargs using `functools.partial`

### In-place Operations (L337-411)
Complete set of augmented assignment operators: `iadd`, `iand`, `iconcat`, `ifloordiv`, `ilshift`, `imod`, `imul`, `imatmul`, `ior`, `ipow`, `irshift`, `isub`, `itruediv`, `ixor`
- All follow pattern: modify operand in-place, return modified value
- `iconcat` includes same type checking as `concat`

### Other Operations
- `call(obj, /, *args, **kwargs)` (L226): Function call with positional-only first parameter

### Module Integration (L413-467)
- Attempts to import C implementation `_operator` for performance
- Establishes dunder-name aliases (`__lt__ = lt`, etc.) for all operators
- Maintains compatibility between pure Python and C implementations

## Architecture Notes
- Fallback implementation pattern: pure Python with optional C acceleration
- Consistent docstring format: "Same as [operator expression]"
- Memory-efficient getter classes using `__slots__`
- Robust error handling with descriptive TypeError/ValueError messages
- Identity-first comparison pattern in sequence operations (`is` before `==`)