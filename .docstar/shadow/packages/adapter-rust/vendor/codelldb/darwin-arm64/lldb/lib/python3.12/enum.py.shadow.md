# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/enum.py
@source-hash: 13a126fa95a66c2f
@generated: 2026-02-09T18:07:19Z

## Python Enum Module Implementation

This file provides a comprehensive implementation of Python's enum functionality, including basic enumerations, flags, and various specialized enum types. It serves as the core library for creating type-safe named constants and flag-based bitwise operations.

### Core Classes and Architecture

**EnumType (L508-1080)** - Metaclass that handles enum class creation, member registration, and validation. Key responsibilities include:
- Member discovery and validation during class creation (L528-596)
- Functional API support for dynamic enum creation (L726-772) 
- Member lookup via `__getitem__` (L810-814) and iteration (L816-826)
- Prevents member reassignment via `__setattr__` (L850-861)

**Enum (L1082-1296)** - Base enumeration class providing:
- Member lookup by value via `__new__` (L1129-1184)
- Default value generation with `_generate_next_value_` (L1188-1222)
- String representations and member access via `name`/`value` properties (L1287-1295)

**Flag (L1368-1598)** - Bitwise flag enumeration supporting:
- Bitwise operations (`__or__`, `__and__`, `__xor__`, `__invert__`) (L1551-1597)
- Composite member creation from missing values (L1415-1505)
- Boundary handling for invalid flag combinations via `FlagBoundary` (L1353-1365)

**Mixed-in Types:**
- **IntEnum (L1304-1308)** - Integer-backed enums
- **StrEnum (L1310-1342)** - String-backed enums with lowercase auto-generation
- **IntFlag (L1600-1604)** - Integer flags with KEEP boundary default
- **ReprEnum (L1298-1302)** - Base for custom repr behavior

### Key Support Classes

**_EnumDict (L376-506)** - Custom dictionary for enum class construction that:
- Tracks member names and prevents duplicates (L383-388)
- Handles `auto()` value generation (L464-494) 
- Enforces naming conventions (sunder/dunder validation) (L410-440)

**_proto_member (L246-374)** - Intermediate object that converts to actual enum members during `__set_name__`, handling aliasing and descriptor setup.

**auto (L179-188)** - Sentinel for automatic value generation
**property (L189-244)** - Enhanced descriptor for enum member access

### Utility Functions

**Validation and Creation:**
- `unique()` (L1612-1625) - Decorator ensuring no duplicate values
- `verify()` (L1873-1956) - Multi-constraint validation decorator
- `_simple_enum()` (L1692-1860) - Fast enum creation decorator bypassing full metaclass machinery

**Bit Manipulation:**
- `_is_single_bit()` (L93-100) - Single bit detection for flags  
- `_iter_bits_lsb()` (L117-127) - LSB-first bit iteration
- `_high_bit()` (L1606-1610) - Highest bit index detection

**Global Export Functions:**
- `global_enum()` (L1677-1690) - Module-level member export
- `global_enum_repr()`/`global_flag_repr()` (L1635-1665) - Module-qualified representations

### Design Patterns

The implementation uses several sophisticated patterns:
1. **Two-phase construction** - `_proto_member` objects converted during `__set_name__`
2. **Descriptor-based member access** - Custom `property` class for name/value protection  
3. **Boundary pattern** - `FlagBoundary` enum controls invalid value handling
4. **Functional API** - Metaclass `__call__` method supports both member lookup and dynamic creation

### Critical Invariants

- Member names must be unique within an enum class
- Flag values should be powers of 2 for single-bit flags
- Mixed-in data types (int, str) must be the second-to-last base class
- Auto-generated values must be sortable and support `+1` operation