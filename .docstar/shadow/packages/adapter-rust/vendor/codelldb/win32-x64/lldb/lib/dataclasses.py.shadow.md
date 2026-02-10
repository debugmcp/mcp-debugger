# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/dataclasses.py
@source-hash: d242aea5fcf6408b
@generated: 2026-02-09T18:13:29Z

## Core Purpose
Python's dataclass implementation providing decorators and utilities for automatic generation of dunder methods (__init__, __repr__, __eq__, etc.) based on class annotations. Part of the standard library dataclasses module.

## Key Classes

### Field (L295-356)
Represents metadata for a single dataclass field. Contains configuration like `default`, `default_factory`, `init`, `repr`, `hash`, `compare`, `metadata`, `kw_only`, and internal `_field_type`. Name and type are populated after instantiation during class processing.

### InitVar (L268-283)
Wrapper for init-only variables that are passed to `__init__` but not stored as instance attributes. Used for parameters needed during initialization but not as persistent fields.

### FrozenInstanceError (L172)
Exception raised when attempting to modify fields on a frozen dataclass instance.

### _DataclassParams (L359-398)
Internal container storing dataclass configuration parameters: `init`, `repr`, `eq`, `order`, `unsafe_hash`, `frozen`, `match_args`, `kw_only`, `slots`, `weakref_slot`.

## Primary Functions

### dataclass() (L1247-1275)
Main decorator that transforms a class into a dataclass. Delegates to `_process_class()` for actual implementation.

### _process_class() (L921-1152)
Core dataclass transformation logic. Processes inheritance, field discovery, method generation, and applies all dataclass behaviors. Handles complex validation and compatibility rules between frozen/unfrozen inheritance.

### field() (L404-425)
Factory function creating Field instances with specified configuration. Validates that both `default` and `default_factory` cannot be specified together.

## Method Generation Functions

### _init_fn() (L568-624)
Generates `__init__` method code dynamically. Handles standard fields, keyword-only fields, default values, default factories, frozen classes, and post-init hooks.

### _repr_fn() (L627-635)
Creates `__repr__` method returning class name with field values. Uses `_recursive_repr` to handle circular references.

### _frozen_get_del_attr() (L638-658)
Generates `__setattr__` and `__delattr__` methods for frozen classes that raise `FrozenInstanceError` for field modifications.

### _hash_fn() (L675-680)
Creates `__hash__` method based on hashable fields (determined by `f.hash` or `f.compare` if `f.hash` is None).

### _cmp_fn() (L661-672)
Generates comparison methods (`__eq__`, `__lt__`, etc.) that compare field tuples between instances.

## Field Processing

### _get_field() (L760-855)
Converts class annotations and attributes into Field objects. Handles ClassVar/InitVar detection, validation, and kw_only assignment. Prevents mutable defaults without default_factory.

### _fields_in_init_order() (L428-434)
Separates fields into standard and keyword-only groups for `__init__` parameter ordering.

## Utility Functions

### fields() (L1278-1293)
Returns tuple of Field objects for a dataclass, excluding ClassVar and InitVar pseudo-fields.

### asdict() / _asdict_inner() (L1308-1386)
Recursively converts dataclass instances to dictionaries. Handles nested dataclasses, namedtuples, containers, and uses `copy.deepcopy()` for other objects. Fast path optimization for atomic types.

### astuple() / _astuple_inner() (L1389-1447)
Similar to asdict but converts to tuples. Maintains type structure for namedtuples and containers.

### replace() (L1540-1588)
Creates new dataclass instance with specified field changes. Validates init-only field restrictions and handles InitVar requirements.

### make_dataclass() (L1450-1537)
Dynamically creates dataclass types with specified fields and configuration. Validates field names and handles module assignment for pickling.

## Constants and Sentinels

- `MISSING` (L186): Sentinel for unspecified parameters
- `KW_ONLY` (L192): Marker for keyword-only field sections
- `_HAS_DEFAULT_FACTORY` (L180): Sentinel for fields with factory functions
- `_FIELDS` (L210): Attribute name storing Field objects on classes
- `_PARAMS` (L214): Attribute name storing dataclass parameters
- `_ATOMIC_TYPES` (L227-246): Immutable types for optimization in asdict/astuple

## Hash Logic
Complex hash method generation controlled by `_hash_action` lookup table (L900-916) based on `unsafe_hash`, `eq`, `frozen`, and existing `__hash__` method presence.

## Slots Integration
`_add_slots()` (L1192-1244) creates new class with `__slots__` by reconstructing the class type, handling inheritance and weakref slots. Includes special pickling support for frozen+slots combination via `_dataclass_getstate`/`_dataclass_setstate` (L1159-1166).