# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/dbm/ndbm.py
@source-hash: 1bcc2d9b2fad1901
@generated: 2026-02-09T18:10:21Z

## Primary Purpose
Bridge module that re-exports the `_dbm` module as a `dbm` submodule, providing database management functionality through a thin compatibility layer.

## Key Components
- **Wildcard import (L3)**: Re-exports all symbols from the `_dbm` C extension module using `from _dbm import *`

## Dependencies
- **`_dbm` module**: Core C extension module that provides the actual DBM database functionality

## Architectural Pattern
This follows Python's common pattern of providing a pure Python wrapper around C extension modules for API compatibility and namespace organization. The file serves as a compatibility shim that allows the low-level `_dbm` module to be accessed through the higher-level `dbm` package structure.

## Critical Notes
- This is a minimal re-export module with no additional functionality
- All actual database operations are handled by the underlying `_dbm` C extension
- The wildcard import means all `_dbm` symbols become available in this namespace