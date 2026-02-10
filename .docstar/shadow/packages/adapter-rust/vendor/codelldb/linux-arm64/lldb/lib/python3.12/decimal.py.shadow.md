# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/decimal.py
@source-hash: c3e37c55ef72b3dd
@generated: 2026-02-09T18:08:36Z

## Purpose
This file serves as the main entry point for Python's decimal arithmetic module, providing high-precision decimal floating-point arithmetic that avoids binary floating-point representation issues. It's particularly useful for financial applications and contexts requiring exact decimal calculations.

## Architecture & Key Components

### Import Strategy (L101-108)
The module implements a fallback import pattern:
- **Primary**: Attempts to import from `_decimal` (C extension for performance)
- **Fallback**: Uses `_pydecimal` (pure Python implementation) if C extension unavailable
- Imports all public API (`*`) plus version metadata from the chosen backend

### Public API (Imported via *)
The actual implementation resides in either `_decimal` or `_pydecimal`, but typically includes:
- `Decimal` class for decimal number representation
- `Context` class for arithmetic configuration (precision, rounding, trap handling)
- Exception classes (`DivisionByZero`, `InvalidOperation`, etc.)
- Context management functions (`getcontext()`, `setcontext()`)
- Predefined contexts (`ExtendedContext`, etc.)

## Key Features Demonstrated (L23-98)
- **Exact decimal arithmetic**: Avoids floating-point precision issues
- **Configurable precision**: Context-based precision control
- **Special values**: Handles Infinity, -Infinity, and NaN
- **Exception handling**: Configurable traps and flags for arithmetic exceptions
- **Context isolation**: Multiple contexts with different settings

## Dependencies
- `_decimal`: C extension (preferred for performance)
- `_pydecimal`: Pure Python fallback implementation
- Based on General Decimal Arithmetic Specification and IEEE 854-1987 standard

## Usage Patterns
1. **Basic arithmetic**: Direct Decimal operations with exact results
2. **Precision control**: Context manipulation for different precision requirements
3. **Exception management**: Trap/flag configuration for error handling
4. **Financial calculations**: Exact decimal representation for monetary values