# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/enum.py
@source-hash: 13a126fa95a66c2f
@generated: 2026-02-09T18:08:51Z

**Core Purpose**: Python's standard `enum` module implementation providing enumeration types with comprehensive metaclass-based member creation, value handling, and flag operations.

## Primary Classes

### Metaclass Infrastructure
- **EnumType (L508-1079)**: Primary metaclass for all enum types
  - `__prepare__` (L514): Creates `_EnumDict` namespace for member tracking
  - `__new__` (L528): Complex enum class creation with member processing, boundary handling, and inheritance resolution
  - `__call__` (L726): Dual-purpose method for member lookup or functional API enum creation
  - `_create_` (L863): Functional API implementation for dynamic enum creation
  - `_convert_` (L919): Convert module constants to enum members

### Core Enum Classes
- **Enum (L1082-1296)**: Base enumeration class
  - `__new__` (L1129): Member lookup with `_missing_` hook fallback
  - `_generate_next_value_` (L1188): Auto-value generation for `auto()` instances
  - Properties: `name` (L287) and `value` (L292) via custom property descriptor

- **ReprEnum (L1298)**: Base for enums that only customize `__repr__`
- **IntEnum (L1304)**: Integer-compatible enum
- **StrEnum (L1310)**: String-compatible enum with custom `__new__` and lowercase auto-generation
- **Flag (L1368-1598)**: Bitwise flag operations with boundary control
- **IntFlag (L1600)**: Integer-based flags with KEEP boundary default

### Support Classes
- **_EnumDict (L376-506)**: Special dict for enum creation tracking member names and handling `auto()`, sunder names, and duplicate detection
- **_proto_member (L246-374)**: Intermediate member during class creation, handles complex member instantiation via `__set_name__`
- **property (L189-244)**: Custom descriptor for enum attributes with class/instance behavior differences
- **auto (L179)**: Placeholder for automatic value generation
- **member/nonmember (L24-36)**: Force/prevent enum membership during class creation

## Key Utilities
- **unique (L1612)**: Decorator ensuring no duplicate values
- **verify (L1873)**: Decorator for enum constraint validation (CONTINUOUS, UNIQUE, NAMED_FLAGS)  
- **_simple_enum (L1692)**: Performance-optimized enum creation bypassing safety checks
- **global_enum (L1677)**: Module-level member export with custom repr

## Flag Boundary Handling
- **FlagBoundary (L1353)**: Enum defining boundary behaviors (STRICT, CONFORM, EJECT, KEEP)
- Complex `_missing_` logic in Flag (L1415) handles out-of-range values per boundary setting

## Helper Functions
- Name classification: `_is_dunder` (L48), `_is_sunder` (L59), `_is_private` (L79)
- Bit manipulation: `_is_single_bit` (L93), `_iter_bits_lsb` (L117), `_high_bit` (L1606)
- Value processing: `bin` (L132) for two's complement representation

## Architecture Notes
- Extensive use of metaclass `__set_name__` protocol for member creation
- Dual lookup systems: `_value2member_map_` for hashable values, linear search for unhashable
- Complex inheritance resolution for mixed-in data types
- Thread-safe member creation with `setdefault` patterns