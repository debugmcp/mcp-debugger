# packages/adapter-rust/vendor/codelldb/darwin-x64/adapter/scripts/codelldb/value.py
@source-hash: 18398c8241125c21
@generated: 2026-02-09T18:07:36Z

## Purpose
Python wrapper module that provides Pythonic operator overloading for LLDB SBValue objects, enabling natural Python syntax for debugging operations in CodeLLDB adapter.

## Key Classes

### Value (L6-239)
Primary wrapper class that encapsulates LLDB SBValue and implements Python's data model operators.

**Core Methods:**
- `__init__(self, sbvalue)` (L10): Wraps SBValue in `__sbvalue` slot
- `unwrap(cls, value)` (L13-15): Class method to extract underlying SBValue from Value instances
- `__getitem__(self, key)` (L26-33): Array/slice access using LLDB expression paths
- `__getattr__(self, name)` (L38-42): Member access via `GetChildMemberWithName()`
- `__iter__(self)` (L35-36): Returns ValueIter for iteration

**Type Conversion Methods (L59-84):**
- `__int__()` uses `is_numeric_type()` to determine signed/unsigned access
- `__float__()` handles numeric float types via `GetValue()`
- `__oct__()`, `__hex__()` format unsigned values

**Arithmetic Operators (L92-175):**
- Left-side ops (`__add__`, `__sub__`, etc.) delegate to `get_value()`
- Right-side ops (`__radd__`, `__rsub__`, etc.) swap operand order
- All operators extract actual values before computation

**In-place Operators (L177-219):**
- `__inplace(self, result)` (L178-180): Updates underlying SBValue via `SetValueFromCString()`
- All in-place methods delegate to corresponding binary operator then call `__inplace()`

**Comparison Operators (L221-238):**
- All comparisons extract values via `get_value()` before comparison

### ValueIter (L241-260)
Iterator class for Value objects that traverses SBValue children.

**Attributes:**
- `index`, `sbvalue`, `length` tracked in slots for efficiency
- `__next__()` (L252-257): Returns Value-wrapped children via `GetChildAtIndex()`
- `next = __next__` (L259): Python 2 compatibility alias

## Key Functions

### get_value(v) (L262-281)
Core value extraction function that converts Value instances to Python primitives.
- Uses `is_numeric_type()` to determine appropriate LLDB getter method
- Handles string summary extraction with quote stripping (L275-278)
- Provides passthrough for non-Value types

### is_numeric_type(sbvalue) (L283-284)
Type introspection helper that maps LLDB basic types to traits via `type_traits` lookup.

## Critical Data Structure

### type_traits (L287-321)
Comprehensive mapping of LLDB basic types to (is_numeric, is_signed, is_float) tuples.
- Covers all LLDB basic types from invalid/void to complex numbers
- Used by numeric conversion methods to determine appropriate access strategy
- Boolean types marked as non-numeric (L309)

## Architecture Notes
- Uses `__slots__` for memory efficiency in both classes
- Consistent delegation pattern: operators → `get_value()` → type-specific extraction
- Maintains LLDB object lifecycle through careful wrapping/unwrapping
- Provides seamless Python integration for debugger value manipulation