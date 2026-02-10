# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/importlib/_abc.py
@source-hash: 80aab7931dc999de
@generated: 2026-02-09T18:11:00Z

## Purpose and Responsibility
Minimal subset of importlib.abc module designed to reduce import overhead in importlib.util. Provides essential abstract base class for Python module loaders without importing the full importlib.abc infrastructure.

## Key Components

### Loader Abstract Base Class (L6-39)
Abstract base class defining the interface for Python module loaders. Uses abc.ABCMeta metaclass to enforce abstract methods in subclasses.

**Key Methods:**
- `create_module(spec)` (L10-18): Factory method for module creation. Returns None by default to defer to spec's default module creation semantics. Should raise ImportError if module creation fails.
- `load_module(fullname)` (L23-39): Deprecated backward compatibility method for loading modules. Delegates to `_bootstrap._load_module_shim()` if `exec_module()` exists on the loader instance.

## Dependencies
- `_bootstrap` module (L2): Internal importlib module providing `_load_module_shim()` utility
- `abc` module (L3): Standard library abstract base classes

## Architectural Decisions
- **Minimal imports**: Deliberately imports only essential dependencies to avoid circular import issues
- **Backward compatibility**: `load_module()` provides fallback for loaders that don't implement modern `exec_module()` interface
- **Default implementations**: `create_module()` returns None by default, allowing specs to handle module creation
- **Deferred exec_module**: Intentionally omits `exec_module()` definition to maintain hasattr() compatibility checks

## Critical Invariants
- Loaders must implement `exec_module()` to use `load_module()` functionality
- `create_module()` returning None triggers spec's default module creation
- ImportError is the standard exception for loader failures