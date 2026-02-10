# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/decimal.py
@source-hash: c3e37c55ef72b3dd
@generated: 2026-02-09T18:09:34Z

## Primary Purpose
This module provides Python's decimal arithmetic implementation, serving as the standard library's decimal.py module. It implements IEEE 854-1987 decimal floating-point arithmetic with arbitrary precision bounds, designed to avoid binary floating-point representation issues common in financial calculations.

## Key Architecture
**Import Strategy (L101-108)**: Uses a fallback import pattern - attempts to import from the optimized C extension `_decimal`, falling back to pure Python `_pydecimal` implementation if unavailable. This ensures compatibility across different Python installations while preferring performance when available.

## Core Functionality
The module exposes decimal arithmetic capabilities including:
- Decimal number representation with configurable precision
- Context management for arithmetic operations
- Exception handling for division by zero, invalid operations
- Support for infinity and NaN values
- Mathematical operations (addition, subtraction, multiplication, division, square root, exponentiation)

## Dependencies
- **_decimal**: Preferred C extension for optimized decimal arithmetic
- **_pydecimal**: Pure Python fallback implementation
- Both modules export `__version__` and `__libmpdec_version__` metadata

## Usage Patterns
The extensive docstring (L1-99) demonstrates typical usage patterns:
- Context configuration with `setcontext()` and `getcontext()`
- Decimal construction from strings, integers, and other decimals
- Precision control and trap handling
- Exception management for edge cases

## Critical Notes
- This is a wrapper/selector module - actual implementation resides in imported modules
- The fallback mechanism ensures decimal arithmetic is available even without C extensions
- Module design prioritizes exact decimal representation over binary floating-point approximation