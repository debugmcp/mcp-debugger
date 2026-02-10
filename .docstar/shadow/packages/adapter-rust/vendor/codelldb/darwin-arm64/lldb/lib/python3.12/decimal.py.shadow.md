# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/decimal.py
@source-hash: c3e37c55ef72b3dd
@generated: 2026-02-09T18:07:01Z

## Purpose

This module provides decimal floating-point arithmetic with arbitrary precision, implementing the General Decimal Arithmetic Specification. It serves as Python's standard library decimal module, offering precise arithmetic for financial calculations and contexts where binary floating-point precision issues are problematic.

## Architecture

**Import Strategy (L101-108)**: Uses a fallback import pattern - attempts to import the optimized C implementation `_decimal` first, falling back to pure Python `_pydecimal` if unavailable. This ensures both performance and portability.

## Key Features

- **Arbitrary Precision**: Supports decimal arithmetic with configurable precision bounds
- **Context Management**: Provides context objects for controlling precision, rounding, and exception handling
- **IEEE 854-1987 Compliance**: Implements IEEE standard for decimal floating-point arithmetic
- **Financial Applications**: Designed to handle monetary calculations with exact decimal representation

## Core Components (Imported)

The module imports all functionality from either:
- `_decimal` (C implementation) - preferred for performance
- `_pydecimal` (Python implementation) - fallback for compatibility

Key imported elements include:
- `Decimal` class for decimal number representation
- `Context` class for arithmetic context management
- Exception classes for decimal-specific errors
- Utility functions for context manipulation

## Dependencies

- **Primary**: `_decimal` (C extension module)
- **Fallback**: `_pydecimal` (pure Python implementation)
- **Standards**: Based on General Decimal Arithmetic Specification and IEEE 854-1987

## Usage Patterns

The extensive docstring examples (L23-98) demonstrate:
- Basic decimal creation and arithmetic
- Precision control via context
- Exception handling and traps
- Special values (Infinity, NaN)
- Context flag management

## Critical Notes

- Module acts as a facade, delegating all functionality to underlying implementations
- Version information is imported from the selected implementation
- Choice between C and Python implementation is transparent to users