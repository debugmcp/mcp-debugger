# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/_pydecimal.py
@source-hash: f918a55369a8eede
@generated: 2026-02-09T18:13:00Z

**Python Decimal Arithmetic Module**

This module provides the `_pydecimal.py` implementation of Python's decimal arithmetic module, implementing the IBM General Decimal Arithmetic Specification for arbitrary-precision decimal arithmetic.

## Core Classes

### Decimal Class (L426-3669)
Primary class representing decimal numbers with arbitrary precision. Key attributes stored in `__slots__`:
- `_exp`: exponent (integer or string for special values)
- `_int`: coefficient as string of digits  
- `_sign`: 0 for positive, 1 for negative
- `_is_special`: boolean flag for NaN/Infinity

**Constructor patterns:**
- String parsing via regex (L462-496)
- Integer conversion (L498-507)
- Tuple/list format (L526-568)
- Float conversion with `from_float()` classmethod (L585-628)

**Arithmetic operations:**
- Addition/subtraction (L1070-1178) with complex sign handling and normalization
- Multiplication (L1180-1234) with optimizations for powers of 10
- Division (L1237-1294) with exact/inexact result handling
- Power operations (L2212-2426) supporting modular exponentiation

**Special methods:**
- Comparison operators (L794-836) with NaN handling per IEEE 754
- Hash implementation (L856-880) compatible with int/float/Fraction
- String formatting (L3672-3756) supporting PEP 3101 format specs

### Context Class (L3797-4541)
Manages arithmetic context including precision, rounding mode, and exception handling.

**Key attributes:**
- `prec`: precision in decimal digits
- `rounding`: rounding mode (one of ROUND_* constants)
- `Emin/Emax`: exponent limits
- `traps/flags`: exception handling configuration

**Context operations:**
- Arithmetic methods that delegate to Decimal operations
- Exception raising via `_raise_error()` (L3952-3972)
- Flag management for tracking arithmetic conditions

## Exception Hierarchy (L95-326)

Base exception `DecimalException` (L95-116) with specialized subclasses:
- `InvalidOperation` (L130-157): Invalid arithmetic operations
- `DivisionByZero` (L169-183): Division by zero
- `Overflow/Underflow` (L256-307): Exponent range violations
- `Inexact/Rounded` (L207-243): Precision loss indicators

## Utility Functions

**String parsing:**
- `_parser` regex (L6044-6062) for number format validation
- Format specifier parsing (L6102-6180) for PEP 3101 support

**Mathematical functions:**
- `_ilog/_dlog/_dlog10` (L5652-5732): Logarithm approximations
- `_iexp/_dexp` (L5815-5886): Exponential approximations  
- `_dpower` (L5888-5928): Power computation

**Context management:**
- `getcontext/setcontext` (L351-370): Thread-local context access
- `localcontext` (L374-417): Context manager for temporary contexts
- `_ContextManager` (L3782-3795): Implementation class

## Constants and Configuration

**Rounding modes** (L69-77): String constants for different rounding behaviors
**Predefined contexts** (L6002-6027): DefaultContext, BasicContext, ExtendedContext
**Special values** (L6320-6328): Cached Decimal instances for common values

## Thread Safety

Uses `contextvars.ContextVar` (L345) for thread-local context storage, ensuring each thread maintains independent decimal arithmetic state.

## IEEE 754 Compliance

Implements IEEE 754 decimal floating-point semantics including:
- Proper NaN propagation and signaling
- Infinity arithmetic rules
- Subnormal number handling
- Multiple rounding modes