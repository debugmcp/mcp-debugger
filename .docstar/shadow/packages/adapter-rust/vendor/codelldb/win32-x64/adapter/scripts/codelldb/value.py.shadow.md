# packages/adapter-rust/vendor/codelldb/win32-x64/adapter/scripts/codelldb/value.py
@source-hash: 18398c8241125c21
@generated: 2026-02-09T18:10:19Z

## Primary Purpose
LLDB Python wrapper that provides a Pythonic interface to LLDB's SBValue objects by implementing standard Python operators and magic methods for debugging values.

## Key Classes and Functions

### Value (L6-239)
Core wrapper class around LLDB's SBValue with full operator overloading.

**Key Methods:**
- `__init__(sbvalue)` (L10-11): Wraps an SBValue in private `__sbvalue` slot
- `unwrap(value)` (L13-15): Class method to extract SBValue from Value wrapper
- `__getitem__(key)` (L26-33): Array/slice access using LLDB expression paths
- `__getattr__(name)` (L38-42): Member access via LLDB's GetChildMemberWithName
- `__iter__()` (L35-36): Returns ValueIter for iteration
- Type conversion methods (L59-83): `__int__`, `__float__`, `__hex__`, etc. using LLDB value accessors
- Arithmetic operators (L92-133): Full set of binary operators delegating to `get_value()`
- Reverse operators (L135-175): Right-hand operand versions
- In-place operators (L182-219): Modify underlying SBValue via `SetValueFromCString`
- Comparison operators (L222-238): Standard comparison delegation

**Private Helper:**
- `__inplace(result)` (L178-180): Updates SBValue and returns result for in-place ops

### ValueIter (L241-259)
Iterator for Value objects supporting Python iteration protocol.
- Tracks index and length from SBValue children count
- `__next__()` (L252-257): Returns wrapped child values via GetChildAtIndex
- Python 2/3 compatibility with `next = __next__` (L259)

### Utility Functions

#### get_value(v) (L262-280)
Converts Value objects to native Python types (int/float/string).
- Uses `is_numeric_type()` to determine conversion strategy
- Handles string summary cleanup (removes quotes)
- Passthrough for non-Value objects

#### is_numeric_type(sbvalue) (L283-284)
Determines numeric characteristics from LLDB basic type via type_traits lookup.

## Data Structures

### type_traits (L288-321)
Static mapping of LLDB basic types to (is_numeric, is_signed, is_float) tuples.
Comprehensive coverage of C/C++ fundamental types including:
- Integer types (char, int, long, etc.) with signedness
- Floating point types (float, double, long double)
- Complex types and special cases (bool, pointers, Objective-C types)

## Dependencies
- `lldb`: Core LLDB Python bindings
- `operator`: For `operator.index()` in array access
- `typing`: Type annotations

## Architectural Patterns
- **Wrapper Pattern**: Encapsulates SBValue while maintaining Python semantics
- **Delegation**: Most operators delegate to `get_value()` for type conversion
- **Slot Optimization**: Uses `__slots__` for memory efficiency
- **Pythonic Interface**: Full magic method implementation for natural Python usage

## Critical Invariants
- SBValue validity is checked before child access to prevent invalid operations
- Type conversion respects LLDB's signed/unsigned/float semantics
- In-place operations modify the underlying debugger state via string conversion