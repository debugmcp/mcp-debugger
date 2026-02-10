# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/zoneinfo/__init__.py
@source-hash: ac7fb403e4371d07
@generated: 2026-02-09T18:11:23Z

**Package Initialization Module for Python zoneinfo Library**

This `__init__.py` file serves as the public interface for the zoneinfo timezone handling library, providing timezone information parsing and management capabilities commonly used in datetime operations.

## Primary Exports (L1-8)
The module exports 7 key symbols via `__all__`: `ZoneInfo`, `reset_tzpath`, `available_timezones`, `TZPATH`, `ZoneInfoNotFoundError`, `InvalidTZPathWarning`.

## Core Dependencies and Imports
- **_tzpath module** (L10): Internal module handling timezone path management and discovery
- **_common.ZoneInfoNotFoundError** (L11): Exception for missing timezone data
- **ZoneInfo class** (L14-16): Main timezone class with fallback import strategy

## Import Strategy for ZoneInfo (L13-16)
Implements a graceful fallback pattern: attempts to import `ZoneInfo` from the C extension `_zoneinfo`, falls back to pure Python implementation `._zoneinfo` on ImportError. The `pragma: nocover` indicates the fallback is rarely tested, suggesting the C extension is typically available.

## Function Aliases (L18-20)
Creates module-level aliases for commonly used functions:
- `reset_tzpath = _tzpath.reset_tzpath`: Resets timezone path configuration
- `available_timezones = _tzpath.available_timezones`: Lists available timezone identifiers
- `InvalidTZPathWarning = _tzpath.InvalidTZPathWarning`: Warning for invalid timezone paths

## Dynamic Attribute Access (__getattr__, L23-27)
Implements lazy loading for `TZPATH` attribute - only loads timezone path when explicitly accessed. Raises AttributeError for unknown attributes with descriptive message.

## Directory Listing Override (__dir__, L30-31)
Custom `__dir__` implementation ensures `TZPATH` appears in tab-completion and introspection tools even though it's dynamically loaded.

## Architectural Pattern
This module follows Python's standard library pattern for timezone handling, providing a clean public API while abstracting internal implementation details. The graceful C/Python fallback ensures compatibility across different Python installations.