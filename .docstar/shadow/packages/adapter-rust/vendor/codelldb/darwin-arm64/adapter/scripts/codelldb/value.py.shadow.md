# packages/adapter-rust/vendor/codelldb/darwin-arm64/adapter/scripts/codelldb/value.py
@source-hash: 18398c8241125c21
@generated: 2026-02-09T18:06:57Z

**Primary Purpose**: Python wrapper for LLDB's SBValue that provides Pythonic operators and data access for debugging adapter functionality in CodeLLDB.

**Core Classes**:

**Value (L6-239)**: Main wrapper class implementing Python's data model for LLDB values
- `__init__` (L10): Wraps SBValue instance in `__sbvalue` slot
- `unwrap` (L14): Class method extracts SBValue from Value wrapper or returns raw value
- Container operations: `__getitem__` (L26) supports indexing/slicing, `__getattr__` (L38) accesses struct members, `__iter__` (L35) enables iteration, `__len__` (L85) returns child count
- Type conversion: `__int__` (L59) handles signed/unsigned integers, `__float__` (L69) converts to float, `__str__` (L20) delegates to `get_value`
- Arithmetic operators (L92-133): Complete set of binary operations using `get_value` for operand extraction
- Reverse operators (L135-175): Right-hand operand support for arithmetic
- In-place operators (L182-219): Modify underlying SBValue via `__inplace` (L178) helper
- Comparison operators (L222-238): Full comparison suite

**ValueIter (L241-259)**: Iterator for Value containers
- Maintains index/length state, yields wrapped Value objects
- Python 2/3 compatibility with `next = __next__` (L259)

**Utility Functions**:
- `get_value` (L262-280): Converts Value to Python primitives (int/float/string), handles string summary formatting
- `is_numeric_type` (L283-284): Type classification using type_traits lookup

**Key Dependencies**:
- `lldb`: Core LLDB Python bindings for debugger integration
- `operator`: Standard Python operator utilities

**Type System**:
- `type_traits` (L288-321): Comprehensive mapping of LLDB basic types to (is_numeric, is_signed, is_float) tuples
- Handles all C/C++ fundamental types including complex numbers, wide characters, and Objective-C types

**Architecture**: Delegation pattern where Value wraps SBValue and delegates operations through `get_value` for consistent type handling. Memory-efficient using `__slots__` for both classes.