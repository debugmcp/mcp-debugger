# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/__future__.py
@source-hash: 981d4c398849f9eb
@generated: 2026-02-09T18:11:25Z

**Purpose**: Python's `__future__` module tracking phased-in incompatible language changes and their release schedules. This is the standard library module that enables forward-compatible imports like `from __future__ import annotations`.

**Architecture**:
- **all_feature_names** (L50-61): List of all future feature names for programmatic access
- **__all__** (L63): Public API exports including feature names list and individual features
- **CO_xxx constants** (L69-78): Compiler flags matching C defines in cpython/compile.h for dynamic compilation

**Core Class**:
- **_Feature** (L81-107): Represents a future language feature with:
  - `__init__(optionalRelease, mandatoryRelease, compiler_flag)` (L83-86)
  - `getOptionalRelease()` (L88-93): Returns 5-tuple when feature was first recognized
  - `getMandatoryRelease()` (L95-101): Returns 5-tuple when feature becomes mandatory (or None)
  - `__repr__()` (L103-106): Standard representation

**Feature Instances** (L109-147):
All instantiated as module-level variables with (optional_release, mandatory_release, compiler_flag):
- **nested_scopes**: Python 2.1 → 2.2
- **generators**: Python 2.2 → 2.3  
- **division**: Python 2.2 → 3.0 (true division)
- **absolute_import**: Python 2.5 → 3.0
- **with_statement**: Python 2.5 → 2.6
- **print_function**: Python 2.6 → 3.0
- **unicode_literals**: Python 2.6 → 3.0
- **barry_as_FLUFL**: Python 3.1 → 4.0 (April Fools feature)
- **generator_stop**: Python 3.5 → 3.7
- **annotations**: Python 3.7 → None (PEP 563, postponed evaluation)

**Key Invariants**:
- No feature line is ever deleted (L47)
- Release tuples follow sys.version_info format: (major, minor, micro, level, serial)
- Compiler flags must match Include/cpython/compile.h defines
- OptionalRelease typically < MandatoryRelease, except when MandatoryRelease is None

**Dependencies**: None (pure data/metadata module)

**Usage Pattern**: This module enables `from __future__ import feature_name` statements and provides metadata for Python's compiler and tools to handle language evolution.