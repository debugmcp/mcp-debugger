# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/enum.py
@source-hash: 13a126fa95a66c2f
@generated: 2026-02-09T18:07:51Z

## Primary Purpose
This file is Python's standard library enum module implementation, providing enumeration classes that create symbolic names for sets of related constants. It supports basic Enum, IntEnum, StrEnum, Flag, and IntFlag types with extensive metaclass-based creation machinery.

## Key Classes and Functions

### Core Enum Classes
- **EnumType (L508-1079)**: Metaclass for all enum types, handles enum creation via `__new__` and `__prepare__`, manages member registration and validation
- **Enum (L1082-1296)**: Base enumeration class with member lookup, iteration, and string representation
- **ReprEnum (L1298-1302)**: Only customizes repr() while preserving str() and format() from mixed-in types
- **IntEnum (L1304-1308)**: Enum that mixes with int, members are integers
- **StrEnum (L1310-1342)**: Enum that mixes with str, members are strings with custom `__new__` validation
- **Flag (L1368-1598)**: Supports bitwise flag operations with boundary checking
- **IntFlag (L1600-1604)**: Integer-based flags combining int, ReprEnum, and Flag

### Support Classes
- **_EnumDict (L376-506)**: Special dict subclass used during enum class creation, tracks member names and handles auto() values
- **_proto_member (L246-374)**: Intermediate object that converts to actual enum members during class creation via `__set_name__`
- **auto (L179-188)**: Placeholder for automatic value generation
- **property (L189-244)**: Enum-specific descriptor for dynamic attribute access
- **nonmember/member (L24-36, L31-36)**: Decorators to control enum membership during class creation

### Utility Functions
- **unique (L1612-1625)**: Decorator ensuring no duplicate values in enum
- **verify (L1873-1956)**: Decorator for checking enum constraints (CONTINUOUS, NAMED_FLAGS, UNIQUE)
- **global_enum (L1677-1690)**: Decorator making enum members available in module namespace
- **_simple_enum (L1692-1860)**: Fast enum creation decorator bypassing full metaclass machinery

### Helper Functions
- **_is_dunder/_is_sunder/_is_private (L48-91)**: Name classification utilities
- **_is_single_bit/_iter_bits_lsb (L93-130)**: Bit manipulation for Flag enums
- **_make_class_unpicklable (L102-115)**: Prevents pickling for certain enums

## Key Design Patterns

### Metaclass-driven Creation
EnumType uses `__prepare__` to return _EnumDict which tracks members during class definition, then `__new__` processes proto-members into final enum instances.

### Member Creation Pipeline
1. Class attributes become _proto_member instances
2. `__set_name__` converts proto-members to actual enum instances
3. Members are registered in `_member_map_` and `_value2member_map_`
4. Aliases are detected and handled appropriately

### Boundary Handling (Flags)
FlagBoundary enum (L1353-1365) defines STRICT/CONFORM/EJECT/KEEP policies for handling out-of-range flag values.

## Critical Invariants

- Enum members are immutable once created (protected by `__setattr__` override)
- Member names must be unique within an enum class
- Flag values must be integers for bitwise operations
- Auto-generated values use `_generate_next_value_` which can be customized
- Value-to-member mapping supports both hashable (dict) and unhashable (list) values

## Dependencies
- `types.MappingProxyType, DynamicClassAttribute`
- `operator.or_` (for reduce operations)
- `functools.reduce`
- Minimal external dependencies to avoid import cycles