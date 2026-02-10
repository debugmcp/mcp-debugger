# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/dataclasses.py
@source-hash: d242aea5fcf6408b
@generated: 2026-02-09T18:07:20Z

This is Python's standard library `dataclasses` module that provides the `@dataclass` decorator and related utilities for automatic generation of special methods based on class annotations.

## Primary Purpose
Implements the PEP 526-based dataclass decorator that automatically generates `__init__`, `__repr__`, `__eq__`, comparison methods, and `__hash__` for classes based on their type annotations.

## Key Constants and Sentinels
- `MISSING` (L186): Sentinel indicating no value provided
- `KW_ONLY` (L192): Marker for keyword-only fields  
- `_HAS_DEFAULT_FACTORY` (L180): Sentinel for fields with factory functions
- `_FIELDS` (L210): Attribute name where Field objects are stored on classes
- `_PARAMS` (L214): Attribute name for dataclass parameters
- `_ATOMIC_TYPES` (L227-246): Immutable types for fast-path optimization in `asdict`/`astuple`

## Core Classes

### `Field` (L295-357)
Represents a single dataclass field with metadata including default values, factory functions, and behavioral flags (`init`, `repr`, `hash`, `compare`, `kw_only`). Name and type are populated after instantiation during class processing.

### `InitVar` (L268-284)  
Wrapper for initialization-only variables that are passed to `__init__` and `__post_init__` but not stored as instance attributes.

### `_DataclassParams` (L359-399)
Container for all dataclass decorator parameters (`init`, `repr`, `eq`, `order`, `unsafe_hash`, `frozen`, `match_args`, `kw_only`, `slots`, `weakref_slot`).

## Main Decorator Function

### `dataclass()` (L1247-1276)
Primary decorator that can be used as `@dataclass` or `@dataclass(...)`. Delegates to `_process_class()` for actual class transformation.

## Core Processing Functions

### `_process_class()` (L921-1153)
Heart of the dataclass system. Processes class annotations, inherits fields from base classes, validates field configurations, and generates the requested special methods. Handles complex inheritance rules for frozen classes and method generation logic.

### `field()` (L404-426)
Factory function for creating `Field` instances with custom parameters. Validates that both `default` and `default_factory` aren't specified.

### `_get_field()` (L760-856)
Converts class attributes and annotations into `Field` objects. Handles detection of `ClassVar`, `InitVar`, and `KW_ONLY` markers via both direct type checking and string annotation parsing. Validates mutable default values.

## Method Generation Functions

### `_init_fn()` (L568-625)
Generates `__init__` method code with proper parameter ordering (regular args, then keyword-only), default value handling, and `__post_init__` calls.

### `_repr_fn()` (L627-636)
Creates `__repr__` method with recursive representation protection via `_recursive_repr()` decorator.

### `_frozen_get_del_attr()` (L638-659)
Generates `__setattr__` and `__delattr__` methods for frozen dataclasses that prevent modification of fields.

### `_cmp_fn()` (L661-673)
Creates comparison methods (`__eq__`, `__lt__`, etc.) that compare field tuples and return `NotImplemented` for incompatible types.

### `_hash_fn()` (L675-681)
Generates `__hash__` method based on hashable fields.

## Hash Logic System
Complex hash generation logic (L874-919) encoded in `_hash_action` lookup table based on `unsafe_hash`, `eq`, `frozen`, and existing `__hash__` presence. Handles edge cases like setting `__hash__ = None` for unhashable classes.

## Utility Functions

### `fields()` (L1278-1294)
Returns tuple of `Field` objects for a dataclass, excluding pseudo-fields like `ClassVar`.

### `asdict()`/`astuple()` (L1308-1448)  
Recursively convert dataclass instances to dictionaries/tuples, with special handling for namedtuples, collections, and atomic types for performance.

### `make_dataclass()` (L1450-1538)
Dynamically creates dataclass from field specifications, useful for runtime class generation.

### `replace()` (L1540-1588)
Creates new dataclass instance with specified field changes, essential for frozen dataclasses.

## Slots Support
`_add_slots()` (L1192-1245) creates new class with `__slots__` by reconstructing the class dict and handling inheritance of slots from base classes. Adds pickling support for frozen slotted classes.

## Type Detection System
String annotation parsing via `_MODULE_IDENTIFIER_RE` (L223) and `_is_type()` (L701-758) to detect `ClassVar`, `InitVar`, and `KW_ONLY` markers in forward references without full evaluation.

## Key Architectural Decisions
- Fields are processed in MRO order with derived classes overriding base fields
- Method generation is conditional based on existing methods in `__dict__`
- Frozen inheritance is strictly enforced (frozen can't inherit from non-frozen)
- Complex hash generation follows specific precedence rules
- String annotations are parsed with regex for performance over full evaluation