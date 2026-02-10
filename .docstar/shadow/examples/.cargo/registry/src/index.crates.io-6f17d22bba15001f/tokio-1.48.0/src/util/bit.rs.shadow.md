# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/util/bit.rs
@source-hash: ce68628eeb395fd3
@generated: 2026-02-09T18:06:48Z

## Purpose
Bit manipulation utilities for packing/unpacking multiple values within a single `usize`. Provides structured field management for dense data storage in concurrent contexts.

## Core Types

**Pack (L3-7)**: Configuration struct defining a bit field layout with mask and shift parameters. Used to define how values are positioned within a larger integer.

## Key Functions

**Pack::least_significant(width) (L11-15)**: Creates a Pack for storing values in the least significant bits. Starting point for chaining field definitions.

**Pack::then(width) (L18-23)**: Chains field definitions by calculating the next available bit positions. Enables sequential field layout without overlap.

**Pack::width() (L26-28)**: Calculates the bit width of the current field by analyzing the mask pattern.

**Pack::max_value() (L31-33)**: Returns maximum representable value for the field (2^width - 1).

**Pack::pack(value, base) (L35-38)**: Embeds a value into a base integer at the field's position. Preserves other fields through masking.

**Pack::unpack(src) (L40-42)**: Extracts the field's value from a packed integer.

**mask_for(n) (L56-59)**: Utility generating bitmasks with n rightmost bits set using bit manipulation tricks.

**unpack(src, mask, shift) (L62-64)**: Low-level extraction function using mask and shift operations.

## Usage Pattern
Typical usage involves chaining field definitions:
```rust
let field1 = Pack::least_significant(8);  // 8 bits at position 0
let field2 = field1.then(4);              // 4 bits at position 8
```

## Dependencies
- `std::fmt` for Debug implementation

## Architecture Notes
- All operations are const-compatible where possible
- Uses bit manipulation for efficient mask generation
- Debug formatting shows binary representation for easier verification
- Designed for lock-free data structures where atomic operations on packed fields are needed