# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/syn-2.0.110/src/bigint.rs
@source-hash: 0299829b2f7a1a79
@generated: 2026-02-09T18:11:48Z

## Purpose
Internal arbitrary-precision decimal integer implementation for the `syn` crate's `LitInt::base10_digits()` accessor. Stores decimal digits in little-endian format (least significant digit first) and provides basic arithmetic operations for number base conversion.

## Key Components

**BigInt struct (L4-6)**
- `digits: Vec<u8>` - Little-endian storage of decimal digits (0-9)
- Crate-private visibility for internal use only

**Core Methods**
- `new()` (L9-11) - Creates empty BigInt (represents zero)
- `to_string()` (L13-29) - Converts to decimal string representation, handles leading zeros by iterating digits in reverse
- `reserve_two_digits()` (L31-36) - Ensures capacity for carry operations by adding up to 2 zero digits if not already present

**Arithmetic Operations**
- `AddAssign<u8>` (L39-52) - Adds single digit with carry propagation, assumes increment < 16
- `MulAssign<u8>` (L54-66) - Multiplies by single digit with carry, assumes base ≤ 16

## Implementation Details

**Storage Format**: Digits stored in `Vec<u8>` with index 0 = least significant digit, enabling efficient carry propagation during arithmetic.

**Carry Handling**: Both arithmetic operations use `reserve_two_digits()` to prevent overflow, then propagate carries through the digit array.

**Base Conversion Context**: The ≤16 constraints on operations suggest this is used for converting from hexadecimal/octal literals to decimal representation.

## Dependencies
- `std::ops::{AddAssign, MulAssign}` for arithmetic trait implementations

## Architectural Notes
- Little-endian digit storage optimizes for carry propagation in arithmetic
- Pre-allocation strategy in `reserve_two_digits()` prevents reallocations during operations
- String conversion handles the zero case explicitly and skips leading zeros