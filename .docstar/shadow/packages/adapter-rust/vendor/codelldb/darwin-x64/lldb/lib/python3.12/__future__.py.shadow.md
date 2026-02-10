# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/__future__.py
@source-hash: 981d4c398849f9eb
@generated: 2026-02-09T18:07:30Z

## Core Purpose
Python's `__future__` module that defines feature flags for forward compatibility, allowing controlled introduction of language changes across Python versions. This is a standard library module that tracks the evolution of Python language features.

## Key Components

### Feature Registry (L50-63)
- `all_feature_names` (L50-61): List of all supported future feature names
- `__all__` (L63): Module's public API exports

### Compiler Flags (L69-78)
Constants mapping to C-level compiler flags for enabling features:
- `CO_NESTED` (L69): Nested scopes support
- `CO_GENERATOR_ALLOWED` (L70): Generator support (obsolete)
- `CO_FUTURE_DIVISION` (L71): True division behavior
- `CO_FUTURE_ABSOLUTE_IMPORT` (L72): Absolute import semantics
- `CO_FUTURE_WITH_STATEMENT` (L73): with statement support
- `CO_FUTURE_PRINT_FUNCTION` (L74): print as function
- `CO_FUTURE_UNICODE_LITERALS` (L75): Unicode string literals
- `CO_FUTURE_BARRY_AS_BDFL` (L76): April Fools' feature
- `CO_FUTURE_GENERATOR_STOP` (L77): StopIteration handling in generators
- `CO_FUTURE_ANNOTATIONS` (L78): Deferred annotation evaluation

### _Feature Class (L81-107)
Core data structure representing a language feature transition:
- `__init__` (L83-86): Stores optional release, mandatory release, and compiler flag
- `getOptionalRelease()` (L88-93): Returns first release supporting the feature
- `getMandatoryRelease()` (L95-101): Returns release where feature becomes default
- `__repr__` (L103-106): String representation for debugging

### Feature Instances (L109-147)
Pre-defined feature objects with historical version data:
- `nested_scopes` (L109-111): Python 2.1 beta 1 → 2.2 alpha 0
- `generators` (L113-115): Python 2.2 alpha 1 → 2.3 final 0
- `division` (L117-119): Python 2.2 alpha 2 → 3.0 alpha 0
- `absolute_import` (L121-123): Python 2.5 alpha 1 → 3.0 alpha 0
- `with_statement` (L125-127): Python 2.5 alpha 1 → 2.6 alpha 0
- `print_function` (L129-131): Python 2.6 alpha 2 → 3.0 alpha 0
- `unicode_literals` (L133-135): Python 2.6 alpha 2 → 3.0 alpha 0
- `barry_as_FLUFL` (L137-139): Python 3.1 alpha 2 → 4.0 alpha 0
- `generator_stop` (L141-143): Python 3.5 beta 1 → 3.7 alpha 0
- `annotations` (L145-147): Python 3.7 beta 1 → None (indefinite)

## Architecture
Each feature follows a two-phase lifecycle: optional availability (where `from __future__ import` enables it) and mandatory adoption (where it becomes default behavior). The compiler flags enable features in dynamically compiled code via `compile()`.

## Critical Invariants
- Feature lines must never be deleted from this file (L47)
- Version tuples follow `sys.version_info` format: (major, minor, micro, level, serial)
- Compiler flag values must match `Include/cpython/compile.h` definitions
- `None` mandatory release indicates dropped or undetermined features