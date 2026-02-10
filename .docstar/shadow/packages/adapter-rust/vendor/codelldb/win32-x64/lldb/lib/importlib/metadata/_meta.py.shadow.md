# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/importlib/metadata/_meta.py
@source-hash: bd3504040497cd04
@generated: 2026-02-09T18:06:07Z

## Protocol Definitions for Package Metadata

This file defines two Protocol classes that establish type contracts for importlib metadata functionality, part of Python's package metadata system.

### PackageMetadata Protocol (L8-45)
Defines the interface for accessing package metadata with dict-like behavior:
- **Container operations**: `__len__`, `__contains__`, `__getitem__`, `__iter__` (L9-19) for dict-like access
- **Safe retrieval**: `get()` method with overloads (L21-27) supporting optional fallback values
- **Multi-value support**: `get_all()` method with overloads (L29-38) for retrieving all values associated with a key
- **JSON serialization**: `json` property (L40-44) returns Dict[str, Union[str, List[str]]] for JSON-compatible representation

All methods use `...  # pragma: no cover` indicating this is a pure protocol definition without implementation.

### SimplePath Protocol (L47-63) 
Generic protocol (`Protocol[_T]`) defining minimal pathlib.Path-like interface required by PathDistribution:
- **Path construction**: `joinpath()` (L52-53) and `__truediv__` operator (L55-56) for path building
- **Navigation**: `parent` property (L58-60) for accessing parent directory
- **File I/O**: `read_text()` method (L62-63) for reading file contents as string

### Dependencies
- `typing` module for Protocol, generics, and type annotations (L1-2)
- Uses TypeVar `_T` (L5) for generic type parameter in both protocols

### Architectural Notes
- Pure protocol definitions with no concrete implementations
- Designed for structural subtyping - any class implementing these methods satisfies the protocol
- Part of importlib metadata's abstraction layer, allowing different backends to implement the same interface