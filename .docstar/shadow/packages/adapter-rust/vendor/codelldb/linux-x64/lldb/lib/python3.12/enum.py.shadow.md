# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/enum.py
@source-hash: 13a126fa95a66c2f
@generated: 2026-02-09T18:09:54Z

**Core Purpose:** Complete implementation of Python's enum module providing enumeration classes with metaclass-driven member creation, value/name management, and specialized Flag/IntFlag support for bitwise operations.

**Key Classes & Architecture:**

**EnumType/EnumMeta (L508-1079):** Metaclass controlling enum creation
- `__prepare__()` (L514): Returns specialized `_EnumDict` for member collection
- `__new__()` (L528): Core enum construction with member validation, Flag setup, and method inheritance
- `__call__()` (L726): Dual-purpose - member lookup for existing enums or functional API for new enum creation
- `_create_()` (L863): Functional API implementation for dynamic enum creation
- `_convert_()` (L919): Converts module constants to enum members
- Key utilities: `_get_mixins_()`, `_find_new_()`, `_find_data_type_()` for inheritance analysis

**Enum Base Class (L1082-1296):** Primary enumeration implementation
- `__new__()` (L1129): Member lookup with hashable/unhashable value handling and `_missing_()` hook
- `_generate_next_value_()` (L1188): Static method for auto() value generation
- Core properties: `name` (L1287), `value` (L1292) using enum.property descriptors

**Specialized Enum Types:**
- **ReprEnum (L1298):** Changes only repr(), preserving mixed-in type's str/format
- **IntEnum (L1304):** Integer-compatible enums  
- **StrEnum (L1310):** String-compatible enums with validation in `__new__()`
- **Flag (L1368):** Bitwise flag operations with boundary control
- **IntFlag (L1600):** Integer flags combining Flag and int behaviors

**Flag Implementation Details:**
- `_missing_()` (L1415): Complex composite member creation with boundary handling
- Bitwise operators: `__or__`, `__and__`, `__xor__`, `__invert__` (L1551-1593)
- `_iter_member_by_value_()` (L1395): Extracts constituent flags from composite values
- Boundary modes via FlagBoundary enum (L1353): STRICT, CONFORM, EJECT, KEEP

**Support Infrastructure:**

**_EnumDict (L376-506):** Specialized dict for enum construction
- `__setitem__()` (L390): Handles member creation, auto() processing, descriptor detection
- Validates sunder names, processes `_ignore_`, manages `_generate_next_value_`

**_proto_member (L246-374):** Intermediate member representation
- `__set_name__()` (L254): Converts proto-members to actual enum instances with alias detection and descriptor redirection

**Member Control Classes:**
- **nonmember (L24):** Excludes values from enum membership
- **member (L31):** Forces values into enum membership
- **auto (L179):** Automatic value generation marker
- **property (L189):** Enum-aware descriptor for dual class/instance behavior

**Decorators & Validation:**
- **unique() (L1612):** Ensures no duplicate values
- **verify() (L1873):** Multi-constraint validation (UNIQUE, CONTINUOUS, NAMED_FLAGS)
- **global_enum() (L1677):** Module-level member export with modified repr

**Utility Functions:**
- Flag bit manipulation: `_is_single_bit()` (L93), `_iter_bits_lsb()` (L117), `_high_bit()` (L1606)
- Name classification: `_is_dunder()` (L48), `_is_sunder()` (L59), `_is_private()` (L79)
- Enhanced binary representation: `bin()` (L132)

**Key Patterns:**
- Metaclass-driven member creation with deferred instantiation via `_proto_member`
- Dual lookup system: fast hashable (`_value2member_map_`) + slow unhashable (`_unhashable_values_`)
- Boundary-controlled Flag composition for handling invalid bit combinations
- Descriptor-based property system preserving member names while providing access control