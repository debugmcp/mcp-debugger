# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/__future__.py
@source-hash: 981d4c398849f9eb
@generated: 2026-02-09T18:06:59Z

This is Python's `__future__` module, the standard mechanism for managing incompatible language changes through phased introduction. It defines future features that can be imported to enable new language behaviors before they become mandatory.

## Core Architecture

**_Feature class (L81-107)**: Represents a single future language feature with three key attributes:
- `optional`: 5-tuple version when feature was first available via import
- `mandatory`: 5-tuple version when feature becomes default (or None if dropped/undetermined) 
- `compiler_flag`: Bitfield flag for `compile()` function to enable feature dynamically

Methods:
- `getOptionalRelease()` (L88-93): Returns first release supporting the feature
- `getMandatoryRelease()` (L95-101): Returns release when feature becomes mandatory
- `__repr__()` (L103-106): String representation showing all attributes

## Feature Registry

**all_feature_names (L50-61)**: Master list of all defined feature names, used to populate `__all__` exports.

**Compiler Flags (L69-78)**: Bitfield constants matching CO_xxx definitions in CPython's compile.h:
- CO_NESTED, CO_FUTURE_DIVISION, CO_FUTURE_ABSOLUTE_IMPORT, etc.
- CO_GENERATOR_ALLOWED is obsolete (value 0)

## Feature Definitions (L109-147)

Each feature is a module-level _Feature instance defining the transition timeline:

- **nested_scopes** (L109-111): Optional in 2.1.0b1, mandatory in 2.2.0a0
- **generators** (L113-115): Optional in 2.2.0a1, mandatory in 2.3.0
- **division** (L117-119): True division, optional in 2.2.0a2, mandatory in 3.0
- **absolute_import** (L121-123): Optional in 2.5.0a1, mandatory in 3.0
- **with_statement** (L125-127): Optional in 2.5.0a1, mandatory in 2.6.0a0
- **print_function** (L129-131): Optional in 2.6.0a2, mandatory in 3.0
- **unicode_literals** (L133-135): Optional in 2.6.0a2, mandatory in 3.0
- **barry_as_FLUFL** (L137-139): April Fools feature, optional in 3.1.0a2, planned for 4.0
- **generator_stop** (L141-143): StopIteration->RuntimeError, optional in 3.5.0b1, mandatory in 3.7.0a0
- **annotations** (L145-147): PEP 563 string annotations, optional in 3.7.0b1, no mandatory release set (None)

## Key Invariants

- Feature definitions are permanent (L47: "No feature line is ever to be deleted")
- Version tuples follow sys.version_info format: (major, minor, micro, level, serial)
- OptionalRelease typically precedes MandatoryRelease
- MandatoryRelease can be None for dropped/undetermined features
- Compiler flags must match CPython's compile.h definitions