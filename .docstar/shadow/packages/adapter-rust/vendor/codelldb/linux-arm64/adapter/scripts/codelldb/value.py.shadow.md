# packages/adapter-rust/vendor/codelldb/linux-arm64/adapter/scripts/codelldb/value.py
@source-hash: 18398c8241125c21
@generated: 2026-02-09T18:09:22Z

## Purpose
Python wrapper module for LLDB's SBValue objects, providing Pythonic operator overloading and type conversion for debugger values in the CodeLLDB adapter.

## Key Classes

### Value (L6-239)
Primary wrapper class around LLDB's SBValue that implements standard Python operators and conversions:

**Core Functionality:**
- `__init__(sbvalue)` (L10): Wraps LLDB SBValue object
- `unwrap(value)` (L13-15): Class method to extract SBValue from Value wrapper
- `__slots__ = ['__sbvalue']` (L8): Memory optimization using slots

**Container Operations:**
- `__getitem__(key)` (L26-33): Array/slice access via expression path evaluation
- `__iter__()` (L35-36): Returns ValueIter for iteration
- `__len__()` (L85-86): Returns number of children
- `__getattr__(name)` (L38-42): Member access by name

**Type Conversions:**
- `__int__()` (L59-64): Signed/unsigned integer conversion based on type traits
- `__float__()` (L69-74): Float conversion with type checking
- `__str__()` (L20-21): String representation via get_value()
- `__complex__()` (L56-57): Complex number conversion

**Arithmetic Operators:**
- Binary ops (L92-132): +, -, *, /, //, %, **, <<, >>, &, ^, |
- Reverse ops (L134-175): Right-hand operand versions
- In-place ops (L177-219): +=, -=, etc. with `__inplace()` helper (L178-180)
- Unary ops (L44-54): -, +, abs(), ~

**Comparison Operators:**
- All comparison methods (L222-238): <, <=, >, >=, ==, !=

### ValueIter (L241-260)
Iterator class for Value objects:
- `__init__(value)` (L244-247): Initializes index, sbvalue, and length
- `__next__()` (L252-257): Returns wrapped child values
- Python 2 compatibility via `next = __next__` (L259)

## Key Functions

### get_value(v) (L262-280)
Central conversion function that extracts Python-native values from Value wrappers:
- Handles numeric types (int/float) based on type traits
- Processes string values by stripping quotes from summary
- Provides passthrough for non-Value objects

### is_numeric_type(sbvalue) (L283-284)
Type classification helper that queries the `type_traits` lookup table.

## Important Dependencies
- `lldb`: Core LLDB Python bindings for SBValue interaction
- `operator`: For index conversion in `__getitem__`

## Data Structures

### type_traits (L287-321)
Comprehensive lookup table mapping LLDB basic types to (is_numeric, is_signed, is_float) tuples. Covers all LLDB basic types including integers, floats, characters, and special types.

## Architectural Patterns
- **Wrapper Pattern**: Value class wraps SBValue while preserving Python operator semantics
- **Delegation**: Most operators delegate to `get_value()` for actual value extraction
- **Type Safety**: Numeric operations respect LLDB type system via type traits
- **Memory Efficiency**: Uses `__slots__` to minimize memory overhead