# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/dataclasses.py
@source-hash: d242aea5fcf6408b
@generated: 2026-02-09T18:09:45Z

## Primary Purpose

This is Python's standard library `dataclasses.py` module, providing the `@dataclass` decorator and related utilities for automatically generating special methods (__init__, __repr__, __eq__, etc.) based on class field annotations.

## Core Components

### Main Decorator
- **`dataclass()` (L1247-1275)**: The primary decorator that transforms classes by adding dunder methods based on annotated fields. Accepts parameters like `init`, `repr`, `eq`, `order`, `frozen`, `slots`, etc.

### Field Definition Classes
- **`Field` (L295-356)**: Represents a single dataclass field with metadata (name, type, default, init participation, etc.). Created via `field()` function.
- **`InitVar` (L268-283)**: Wrapper for init-only variables that don't become instance attributes
- **`_DataclassParams` (L359-398)**: Stores decorator parameters for a processed dataclass

### Sentinel Objects
- **`MISSING` (L184-186)**: Indicates no default value provided
- **`KW_ONLY` (L190-192)**: Marker for keyword-only field sections  
- **`_HAS_DEFAULT_FACTORY` (L177-180)**: Internal marker for factory defaults
- **`FrozenInstanceError` (L172)**: Exception for frozen dataclass modification attempts

### Core Processing Functions
- **`_process_class()` (L921-1152)**: Main orchestrator that processes a class, discovers fields, generates methods, and handles inheritance
- **`_get_field()` (L760-855)**: Analyzes class attributes/annotations to create Field objects, detecting ClassVar/InitVar patterns
- **`_init_fn()` (L568-624)**: Generates custom __init__ method with proper parameter handling and default factories

### Method Generators  
- **`_repr_fn()` (L627-635)**: Creates __repr__ method showing field values
- **`_hash_fn()` (L675-680)**: Generates __hash__ method from hashable fields
- **`_cmp_fn()` (L661-672)**: Creates comparison methods (__eq__, __lt__, etc.)
- **`_frozen_get_del_attr()` (L638-658)**: Generates __setattr__/__delattr__ for frozen classes

### Utility Functions
- **`fields()` (L1278-1293)**: Returns tuple of Field objects for a dataclass
- **`is_dataclass()` (L1301-1305)**: Checks if object is a dataclass
- **`asdict()`/`astuple()` (L1308-1447)**: Convert dataclass instances to dict/tuple recursively
- **`make_dataclass()` (L1450-1537)**: Dynamically create dataclass from field specifications
- **`replace()` (L1540-1588)**: Create new instance with modified field values

### Slots Support
- **`_add_slots()` (L1192-1244)**: Creates new class with __slots__ for memory efficiency
- **`_get_slots()` (L1169-1189)**: Extracts slot information from class hierarchy

### Hash Logic
- **`_hash_action` (L900-916)**: Lookup table determining hash method generation based on decorator parameters and existing methods

## Key Constants
- **`_FIELDS`** (L210): Attribute name storing Field objects on dataclass
- **`_PARAMS`** (L214): Attribute name storing dataclass parameters
- **`_ATOMIC_TYPES`** (L227-246): Types requiring no recursive processing in asdict/astuple

## Architecture Notes
- Extensive use of dynamic code generation via `_create_fn()` (L449-474) for optimal performance
- Complex inheritance rules ensure frozen/non-frozen compatibility
- String annotation support with regex parsing for ClassVar/InitVar detection
- Thread-safe recursive repr handling via `_recursive_repr()` (L250-266)