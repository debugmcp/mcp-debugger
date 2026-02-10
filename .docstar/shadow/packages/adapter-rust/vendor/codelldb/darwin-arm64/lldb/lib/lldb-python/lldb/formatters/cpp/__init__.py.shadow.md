# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/lldb-python/lldb/formatters/cpp/__init__.py
@source-hash: ba8d470dec436998
@generated: 2026-02-09T18:03:21Z

## Purpose
Package initialization module for LLDB C++ formatters that automatically loads and initializes GNU libstdc++ and libc++ formatter submodules.

## Core Functionality

**Module Auto-Loading (L1-3)**
- Defines `__all__ = ["gnu_libstdcpp", "libcxx"]` to specify available formatter modules
- Dynamically imports both submodules using `__import__()` with full module path construction
- Ensures immediate availability of C++ standard library formatters upon package import

**LLDB Integration Hook (L5-11)**
- `__lldb_init_module()` serves as the standard LLDB debugger initialization entry point
- Iterates through all loaded submodules and calls their individual `__lldb_init_module()` functions if present
- Passes through `debugger` and `internal_dict` parameters to enable proper LLDB integration
- Uses defensive programming with `getattr()` and None check to handle missing init functions gracefully

## Architecture Pattern
Implements a centralized initialization pattern where the parent module orchestrates the loading and initialization of specialized formatter submodules. This allows LLDB to register all C++ formatters through a single entry point while maintaining modular separation between GNU and LLVM C++ standard library implementations.

## Dependencies
- `lldb` module (imported within init function)
- Two formatter submodules: `gnu_libstdcpp` and `libcxx`