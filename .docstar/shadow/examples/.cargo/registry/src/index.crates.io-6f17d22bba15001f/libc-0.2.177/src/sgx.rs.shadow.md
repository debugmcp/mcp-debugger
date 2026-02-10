# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/sgx.rs
@source-hash: 964d6af358f5c85f
@generated: 2026-02-09T18:11:27Z

**Purpose**: Provides SGX (Intel Software Guard Extensions) platform-specific C type definitions for the libc crate.

**Key Type Definitions**:
- `intmax_t` (L5): 64-bit signed integer, largest signed integer type
- `uintmax_t` (L6): 64-bit unsigned integer, largest unsigned integer type
- `size_t` (L8): Platform pointer-sized unsigned integer for object sizes
- `ptrdiff_t` (L9): Platform pointer-sized signed integer for pointer arithmetic
- `intptr_t` (L10): Signed integer type that can hold a pointer value
- `uintptr_t` (L11): Unsigned integer type that can hold a pointer value
- `ssize_t` (L12): Signed size type, typically for return values that can indicate errors

**Constants**:
- `INT_MIN` (L14): Minimum value for 32-bit signed integer (-2,147,483,648)
- `INT_MAX` (L15): Maximum value for 32-bit signed integer (2,147,483,647)

**Dependencies**:
- Uses `crate::prelude::*` (L3) for common libc type imports, likely including `c_int`

**Architectural Notes**:
- SGX-specific type mappings assume 64-bit architecture (intmax/uintmax as 64-bit)
- Pointer-related types (`intptr_t`, `uintptr_t`, `size_t`, `ptrdiff_t`) map to platform word size
- Standard C99/POSIX type definitions adapted for SGX enclave environment
- Part of platform-specific type system in libc crate's modular architecture