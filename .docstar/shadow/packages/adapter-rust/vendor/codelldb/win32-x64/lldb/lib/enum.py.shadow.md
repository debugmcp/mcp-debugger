# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/enum.py
@source-hash: 13a126fa95a66c2f
@generated: 2026-02-09T18:13:28Z

## Python Enum Implementation

**Primary Purpose**: Complete Python enum implementation providing Enum, IntEnum, StrEnum, Flag, and IntFlag classes with their metaclasses and supporting utilities.

### Core Components

**EnumType/EnumMeta (L508-1079)**: Metaclass managing enum creation, member registration, and validation. Key methods:
- `__prepare__()` (L514-526): Creates `_EnumDict` for class construction
- `__new__()` (L528-718): Complex enum class creation with member conversion via `_proto_member`
- `__call__()` (L726-772): Handles both member lookup and functional API
- `_get_mixins_()` (L968-984): Determines member data types from base classes

**Enum Base Class (L1082-1296)**: Core enumeration class with:
- `__new__()` (L1129-183): Member lookup with `_missing_()` fallback
- `_generate_next_value_()` (L1189-222): Default auto-value generation
- `name` and `value` properties (L1287-295) using descriptor pattern

**Flag Class (L1368-1598)**: Bitwise flag enumeration extending Enum:
- `_missing_()` (L1415-505): Complex composite flag creation with boundary handling
- Bitwise operators `__or__`, `__and__`, `__xor__`, `__invert__` (L1551-593)
- `_iter_member_by_value_()` (L1395-400): Extracts component flags from composite values

### Supporting Infrastructure

**_EnumDict (L376-506)**: Special dict for enum construction tracking member names and handling auto() values through `__setitem__()` with extensive validation.

**_proto_member (L246-374)**: Intermediate conversion class with `__set_name__()` method that transforms values into actual enum members during class creation.

**Utility Classes**:
- `auto` (L179-187): Placeholder for automatic value generation  
- `nonmember/member` (L24-36): Control class member inclusion
- `property` (L189-244): Enhanced descriptor for enum attribute access

**Type Variants**:
- `ReprEnum` (L1298-1302): Base for mixed-type enums with custom repr
- `IntEnum` (L1304-1308): Integer-compatible enums
- `StrEnum` (L1310-1342): String-compatible enums with custom `__new__()`
- `IntFlag` (L1600-1604): Integer-compatible flags

### Advanced Features

**Boundary Control**: `FlagBoundary` enum (L1353-1365) with STRICT/CONFORM/EJECT/KEEP modes for handling out-of-range flag values.

**Validation**: 
- `unique()` decorator (L1612-1625): Ensures no duplicate values
- `verify` decorator class (L1873-1956): Comprehensive enum validation with CONTINUOUS/NAMED_FLAGS/UNIQUE checks

**Functional API**: `_create_()` method (L863-917) enables programmatic enum creation.

**Optimization**: `_simple_enum()` decorator (L1692-1860) provides faster enum creation bypassing safety checks.

### Key Architectural Patterns

- **Metaclass-driven construction**: EnumType orchestrates complex member creation process
- **Descriptor protocol**: Extensive use of descriptors for member access and property management  
- **Proxy objects**: `_proto_member` enables deferred member construction
- **Boundary pattern**: Configurable handling of invalid flag combinations
- **Mixin support**: Seamless integration with data types like int/str through `_get_mixins_()`

### Critical Invariants

- Member names stored in `_member_names_` list, values in `_member_map_` dict
- Flag masks maintained in `_flag_mask_`, `_singles_mask_`, `_all_bits_` 
- Value-to-member reverse lookup via `_value2member_map_` with unhashable fallback
- Auto-value generation respects existing values and custom `_generate_next_value_()`