# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/unittest/mock.py
@source-hash: d5a629d9e9737723
@generated: 2026-02-09T18:12:45Z

## Primary Purpose
Python unittest mock library providing comprehensive mocking and patching functionality for testing. Core implementation of Mock objects with automatic spec generation, patching decorators/context managers, and async mock support.

## Key Classes & Functions

### Core Mock Classes
- **NonCallableMock (L409-1074)**: Base mock class with attribute access, spec validation, call tracking, and assertion methods. Uses shared RLock for thread safety (L418). Supports spec/spec_set for attribute validation.
- **CallableMixin (L115-219)**: Adds call functionality to mocks. Handles `__call__`, side effects, return values, and call count tracking.
- **Mock (L222-278)**: Main callable mock combining NonCallableMock + CallableMixin. Primary mock class for most use cases.
- **MagicMock (L2174-2204)**: Mock with magic method implementations. Extends Mock with automatic magic method handling.
- **AsyncMock (L2432-2472)**: Async-aware mock for coroutines. Extends Mock with await tracking and async execution support.

### Patching Infrastructure
- **_patch (L292-628)**: Core patching class supporting decorator/context manager patterns. Handles attribute replacement with automatic restoration.
- **patch() (L1719-1798)**: Main patching function creating _patch instances. Supports autospec, spec_set, and creates appropriate mock types.
- **_patch_dict (L1801-1951)**: Dictionary patching with backup/restore functionality.

### Utility Classes
- **_Call (L2509-2692)**: Tuple subclass representing mock calls with name, args, kwargs. Supports call comparison and chaining.
- **_CallList (L348-365)**: List subclass for storing call objects with subsequence matching.
- **_Sentinel/_SentinelObject (L288-315)**: Named sentinel objects for DEFAULT, MISSING, DELETED values.
- **MagicProxy (L2207-2223)**: Lazy descriptor for magic method creation.
- **PropertyMock (L2988-3003)**: Mock for property descriptors with `__get__`/`__set__` support.

### Autospec System
- **create_autospec() (L2697-2844)**: Creates mocks with automatic spec from target objects. Recursively specs attributes and handles function signatures.
- **_SpecState (L2875-2884)**: Placeholder for deferred autospec creation during attribute access.

## Key Features

### Signature Validation
- `_get_signature_object()` (L90-122) extracts function signatures
- `_check_signature()` (L125-134) adds signature validation to mocks
- `_set_signature()` (L181-205) creates signature-validating wrapper functions

### Magic Method Handling
- Magic method definitions in `_magics`, `_async_magics`, `_non_defaults` (L2018-2030)
- `_get_method()` (L2010-2015) converts callables to proper methods
- Return value calculators for magic methods (L2039-2060)

### Async Support
- `AsyncMockMixin` (L2232-2429) provides await tracking and async assertions
- `_AsyncIterator` (L3030-3044) wraps iterators for async iteration
- Async magic method handling with proper coroutine flags

### Call Tracking & Assertions
- Comprehensive call assertion methods: `assert_called`, `assert_called_with`, `assert_has_calls`, etc.
- Parent-child call propagation through `_increment_mock_call()` (L145-189)
- Call matching with signature normalization via `_call_matcher()` (L875-900)

## Dependencies
- `asyncio`, `inspect`, `contextlib` for async and introspection support
- `threading.RLock` for thread safety
- `unittest.util.safe_repr` for safe representation
- `pkgutil.resolve_name` for target resolution

## Architectural Patterns
- **Delegation Pattern**: Properties delegate to `_mock_delegate` when signature mocking is active
- **Hierarchy Management**: Parent-child relationships track mock call propagation
- **Lazy Creation**: Child mocks created on first attribute access
- **Spec Validation**: Attribute access controlled by spec/spec_set parameters
- **Context Manager Protocol**: Patches implement `__enter__`/`__exit__` for automatic cleanup

## Critical Invariants
- Thread-safe access via shared RLock on NonCallableMock
- Circular reference detection in parent-child relationships
- Signature validation must match original function signatures
- Async mocks require proper coroutine flags and _is_coroutine marker
- Patch cleanup must restore original state even on exceptions