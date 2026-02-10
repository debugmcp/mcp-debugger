# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/operator.py
@source-hash: b2af20f67667203c
@generated: 2026-02-09T18:09:56Z

## Primary Purpose
Pure Python implementation of the standard `operator` module, providing functional interfaces to Python's intrinsic operators and special methods. Acts as a fallback when the C implementation `_operator` is unavailable (L414-418).

## Key Components

### Comparison Operations (L27-49)
- `lt`, `le`, `eq`, `ne`, `ge`, `gt`: Direct wrappers for comparison operators (<, <=, ==, !=, >=, >)

### Logical Operations (L53-67)
- `not_` (L53): Logical negation operator
- `truth` (L57): Boolean conversion with explicit True/False return
- `is_`, `is_not` (L61, L65): Identity comparison operators

### Mathematical/Bitwise Operations (L71-142)
- Arithmetic: `add`, `sub`, `mul`, `truediv`, `floordiv`, `mod`, `pow` (L75-138)
- Bitwise: `and_`, `or_`, `xor`, `lshift`, `rshift`, `inv`/`invert` (L79-142)
- Unary: `abs`, `neg`, `pos` (L71-122)
- Matrix multiplication: `matmul` (L108) for @ operator
- Special: `index` (L87) calls `__index__()` method

### Sequence Operations (L146-222)
- `concat` (L146): Sequence concatenation with type validation
- `contains` (L153): Membership testing (note: operands reversed)
- Item access: `getitem`, `setitem`, `delitem` (L169-183)
- Search: `indexOf` (L173), `countOf` (L157) with identity/equality checks
- `length_hint` (L185): Robust length estimation with fallback to `__length_hint__`

### Callable Operations (L226-228)
- `call` (L226): Generic function call with positional-only first parameter

### Getter Classes (L232-335)
Three utility classes for creating reusable accessor functions:

#### `attrgetter` (L232-270)
- Single/multiple attribute access with dot notation support
- Uses `__slots__` for memory efficiency
- Recursive attribute resolution for dotted names (L247-252)
- Multiple attribute support returns tuples (L255-258)

#### `itemgetter` (L271-301)
- Single/multiple item access via indexing
- Similar pattern to `attrgetter` but for `__getitem__` access
- Optimized single vs. multiple item handling

#### `methodcaller` (L302-335)
- Method invocation with stored arguments and keywords
- Complex `__reduce__` implementation using `functools.partial` for kwargs (L329-334)

### In-place Operations (L339-410)
- All augmented assignment operators (`iadd`, `iand`, `iconcat`, etc.)
- Pattern: modify object in-place and return it
- `iconcat` (L349) includes sequence validation like `concat`

## Architecture Decisions

### Import Strategy (L413-418)
Attempts to import C implementation `_operator` and falls back to pure Python. Uses `try/except ImportError` pattern to maintain compatibility.

### Alias Assignment (L420-467)
Creates `__dunder__` aliases for all functions after potential C import, ensuring correct function references regardless of import source.

### Memory Optimization
Getter classes use `__slots__` to reduce memory overhead for frequently instantiated objects.

### Error Handling
- Type validation in constructors (L244, L313)
- Appropriate error messages matching Python conventions
- Sequence validation in concatenation operations (L148, L351)

## Dependencies
- `builtins.abs` (L22): Imported as `_abs` to avoid naming conflicts
- `functools.partial` (L333): Used conditionally in `methodcaller.__reduce__`

## Critical Invariants
- All in-place operations modify the first operand and return it
- Getter classes maintain immutable state after construction
- `length_hint` always returns non-negative integers or raises appropriate exceptions
- Function aliases (`__dunder__` names) must be assigned after C module import