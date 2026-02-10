# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/macros/addr_of.rs
@source-hash: cbd020a07ffba2b1
@generated: 2026-02-09T18:06:34Z

## Purpose
Utility module providing a declarative macro for generating safe field pointer access methods from struct raw pointers. Enables zero-cost conversion from `NonNull<Struct>` to `NonNull<Field>` while maintaining memory safety invariants.

## Key Components

### `generate_addr_of_methods!` macro (L4-22)
Declarative macro that generates unsafe methods for accessing struct fields via raw pointers.

**Input syntax (L5-11):**
- Takes impl block pattern with generic parameters `$($gen:ident)*`
- Accepts struct type `$struct_name:ty` 
- Generates methods with signature: `unsafe fn $fn_name(self: NonNull<Self>) -> NonNull<$field_type>`
- Field access pattern: `&self$(.$field_name:tt)+` (supports nested field access)

**Generated implementation (L13-21):**
- Creates unsafe method with `NonNull<Self>` parameter (renamed to `me`)
- Uses `addr_of_mut!` macro to get field pointer from dereferenced struct pointer (L17)
- Returns `NonNull::new_unchecked()` wrapping the field pointer (L18)

## Architectural Patterns
- **Zero-cost abstraction**: Compiles to direct pointer arithmetic
- **Macro-generated code**: Reduces boilerplate for pointer field access
- **Memory safety delegation**: Relies on caller to ensure pointer validity
- **Generic-aware**: Preserves type parameters from original struct

## Safety Invariants
- Generated methods are `unsafe` - caller must ensure input `NonNull` points to valid, properly aligned struct
- Uses `new_unchecked()` assuming field pointer is non-null (valid for properly constructed structs)
- Field access via `addr_of_mut!` avoids undefined behavior from dereferencing potentially unaligned pointers

## Dependencies
- `core::ptr::NonNull` for type-safe non-null pointer wrapper
- `std::ptr::addr_of_mut!` for safe field pointer extraction
- Standard macro system for code generation