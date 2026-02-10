# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/decimal.py
@source-hash: c3e37c55ef72b3dd
@generated: 2026-02-09T18:07:34Z

## Purpose
Entry point module for Python's decimal arithmetic library, providing IEEE 754-compliant decimal floating-point arithmetic with arbitrary precision. Acts as a facade that imports implementations from either the C extension (_decimal) or pure Python fallback (_pydecimal).

## Core Architecture
**Import Strategy (L101-108)**: Uses try/except pattern to prefer the optimized C implementation (_decimal) but gracefully falls back to pure Python (_pydecimal) if unavailable. This ensures compatibility across different Python installations while maximizing performance.

## Key Components
- **Decimal Class**: Primary class for decimal arithmetic operations with configurable precision
- **Context Management**: Controls arithmetic behavior (precision, rounding, error handling)
- **Exception Handling**: Comprehensive error conditions (DivisionByZero, InvalidOperation, etc.)
- **Special Values**: Support for Infinity, -Infinity, and NaN

## Usage Patterns
**Basic Operations**: Standard arithmetic (+, -, *, /) with exact decimal representation
**Context Configuration**: `getcontext().prec` for precision control, trap management for error handling
**Financial Applications**: Designed to avoid binary floating-point representation issues (e.g., 1.00 % 0.1 = 0.00 exactly)

## Dependencies
- `_decimal` (C extension, preferred)
- `_pydecimal` (pure Python fallback)
- Follows General Decimal Arithmetic Specification and IEEE 854-1987 standard

## Critical Features
- Arbitrary precision arithmetic with configurable bounds
- Context-based operation control (precision, rounding modes, error traps)
- Exact decimal representation avoiding binary floating-point errors
- Thread-local context management for concurrent applications