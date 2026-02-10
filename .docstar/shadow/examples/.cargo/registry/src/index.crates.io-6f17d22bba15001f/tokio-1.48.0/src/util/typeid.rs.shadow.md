# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/util/typeid.rs
@source-hash: 07ca937bb3f8763c
@generated: 2026-02-09T18:06:51Z

## Purpose
Provides unsafe type transmutation functionality that bypasses Rust's lifetime constraints by comparing TypeIds of source and target types without considering lifetimes.

## Key Functions

### `try_transmute<Src, Target>` (L9-16)
- **Purpose**: Attempts to transmute a value from type `Src` to type `Target` if they have the same underlying type
- **Safety**: Marked unsafe - can extend lifetimes of values, caller must ensure safety
- **Mechanism**: Compares TypeId of source (via `nonstatic_typeid`) with TypeId of target type
- **Returns**: `Result<Target, Src>` - Ok if types match, Err returns original value
- **Implementation**: Uses `ManuallyDrop` wrapper and `mem::transmute_copy` for actual conversion

### `nonstatic_typeid<T>` (L20-44)
- **Purpose**: Obtains TypeId for any type T, including non-'static types, bypassing lifetime constraints
- **Source**: Based on dtolnay/typeid crate implementation (L18 comment)
- **Technique**: Uses trait object transmutation to circumvent 'static bounds
- **Key Components**:
  - `NonStaticAny` trait (L24-28): Defines `get_type_id` method with 'static constraint
  - Implementation for `PhantomData<T>` (L30-38): Provides TypeId via `TypeId::of::<T>()`
  - Unsafe transmutation (L41-43): Converts `&dyn NonStaticAny` to `&(dyn NonStaticAny + 'static)`

## Critical Safety Constraints
- `try_transmute` explicitly does not compare lifetimes (L7-8 comment)
- Values returned as Ok may have extended lifetimes beyond original scope
- Relies on TypeId equality to determine type compatibility
- Uses unsafe transmutation to bypass Rust's lifetime system

## Dependencies
- `std::any::TypeId` for type identification
- `std::marker::PhantomData` for zero-sized type markers
- `std::mem::{ManuallyDrop, transmute_copy, transmute}` for memory manipulation

## Architectural Pattern
Implements a type-erasing transmutation mechanism that trades compile-time safety for runtime flexibility, primarily used internally within the tokio crate for type conversions where lifetime relationships are managed externally.