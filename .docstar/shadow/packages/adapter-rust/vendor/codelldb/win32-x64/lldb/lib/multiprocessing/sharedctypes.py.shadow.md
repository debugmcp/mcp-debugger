# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/multiprocessing/sharedctypes.py
@source-hash: 77ef522912474652
@generated: 2026-02-09T18:11:17Z

## Primary Purpose
Multiprocessing module for allocating ctypes objects in shared memory with synchronization support. Enables safe sharing of C data types between processes through shared memory allocation and locking mechanisms.

## Key Components

### Type Mapping
- `typecode_to_type` (L25-33): Maps single-character type codes to ctypes classes for common C data types (integers, floats, chars)

### Core Factory Functions
- `RawValue(typecode_or_type, *args)` (L44-52): Creates unsynchronized ctypes object in shared memory using heap allocation
- `RawArray(typecode_or_type, size_or_initializer)` (L54-68): Creates unsynchronized ctypes array in shared memory, supports both size specification and initialization from sequence
- `Value(typecode_or_type, *args, lock=True, ctx=None)` (L70-82): Creates synchronized wrapper around RawValue with optional locking
- `Array(typecode_or_type, size_or_initializer, *, lock=True, ctx=None)` (L84-96): Creates synchronized wrapper around RawArray with optional locking

### Utility Functions
- `_new_value(type_)` (L39-42): Internal helper that allocates shared memory buffer and creates ctypes object from it
- `copy(obj)` (L98-101): Creates deep copy of ctypes object in new shared memory location
- `synchronized(obj, lock=None, ctx=None)` (L103-122): Wraps ctypes objects with appropriate synchronization class based on type

### Pickling Support
- `reduce_ctype(obj)` (L128-133): Pickle reduction function for shared ctypes objects
- `rebuild_ctype(type_, wrapper, length)` (L135-142): Reconstruction function that recreates ctypes object from buffer wrapper

### Dynamic Property Generation
- `make_property(name)` (L148-155): Creates thread-safe property descriptors using template code execution
- `template` (L157-171): String template for generating getter/setter methods with automatic locking
- `prop_cache` (L173): Cache for generated properties
- `class_cache` (L174): WeakKeyDictionary cache for dynamically created synchronized classes

### Synchronization Wrapper Classes
- `SynchronizedBase` (L180-209): Base class providing lock acquisition/release, context manager protocol, and pickling support
- `Synchronized` (L212-213): Wrapper for simple ctypes data with thread-safe value property
- `SynchronizedArray` (L216-235): Wrapper for ctypes arrays with thread-safe indexing and slicing operations
- `SynchronizedString` (L238-240): Specialized wrapper for character arrays with value and raw properties

## Dependencies
- `ctypes`: Core C data type support
- `weakref`: Weak reference caching for dynamic classes
- `.heap`: Shared memory buffer allocation
- `.context`: Multiprocessing context and reduction utilities

## Key Patterns
- Factory pattern for creating shared memory objects with optional synchronization
- Dynamic class generation for ctypes structures with automatic property wrapping
- Context manager protocol for automatic lock management
- Lazy initialization with caching for performance optimization

## Critical Invariants
- All shared objects must use heap.BufferWrapper for memory allocation
- Synchronized objects require locks with acquire/release methods
- Pickling only works during process spawning (assert_spawning checks)
- Dynamic classes cached by original ctypes class as weak key