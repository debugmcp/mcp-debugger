# packages/adapter-rust/vendor/codelldb/linux-x64/adapter/scripts/codelldb/value.py
@source-hash: 18398c8241125c21
@generated: 2026-02-09T18:11:24Z

## Purpose
Python wrapper module for LLDB SBValue objects, providing Pythonic operator overloading and value conversion utilities for CodeLLDB adapter. Enables natural Python syntax when working with debugger values in IDE environments.

## Key Classes

### Value (L6-239)
Primary wrapper class around LLDB's SBValue with comprehensive operator overloading.

**Core Methods:**
- `__init__(sbvalue)` (L10-11): Wraps LLDB SBValue object
- `unwrap(value)` (L13-15): Class method to extract underlying SBValue from Value or passthrough
- `__getitem__(key)` (L26-33): Array/slice access using expression path evaluation
- `__getattr__(name)` (L38-42): Member access via GetChildMemberWithName

**Type Conversion Methods:**
- `__int__()` (L59-64): Converts to int using signed/unsigned logic based on type traits
- `__float__()` (L69-74): Converts to float with numeric type detection
- `__str__()` (L20-21): String representation via get_value() function

**Arithmetic Operators (L92-132):** Full set of binary operators (+, -, *, /, //, %, **, <<, >>, &, ^, |)
**Reverse Operators (L135-175):** Right-hand operand versions of arithmetic operators
**In-place Operators (L182-219):** Augmented assignment operators with SetValueFromCString update
**Comparison Operators (L222-238):** Complete set of comparison operators

### ValueIter (L241-259)
Iterator class for Value objects.
- `__init__(value)` (L244-247): Initialize with length caching
- `__next__()` (L252-257): Returns wrapped child values via GetChildAtIndex

## Key Functions

### get_value(v) (L262-280)
Core value extraction function that converts Value objects to Python primitives:
- Numeric values: Uses type traits to determine signed/unsigned/float conversion
- String values: Strips surrounding quotes from GetSummary() result
- Non-Value objects: Passthrough return

### is_numeric_type(sbvalue) (L283-284)
Type classification helper using type_traits lookup table.

## Dependencies
- **lldb**: LLDB Python bindings for SBValue manipulation
- **operator**: For index() conversion in array access
- **typing**: Type hints for get_value return

## Architecture Patterns
- **Proxy Pattern**: Value wraps SBValue while preserving Python operator semantics
- **Type Mapping**: Comprehensive type_traits dictionary (L288-321) maps LLDB basic types to (is_numeric, is_signed, is_float) tuples
- **Operator Delegation**: All operators delegate to get_value() for consistent value extraction
- **Lazy Evaluation**: Child access creates new Value wrappers on demand

## Critical Invariants
- Value objects maintain single __sbvalue reference via __slots__
- In-place operations update underlying SBValue via SetValueFromCString
- Type detection drives numeric conversion strategy (signed vs unsigned vs float)
- Iterator maintains separate index state for each iteration session