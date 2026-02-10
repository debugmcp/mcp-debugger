# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/pin-project-lite-0.2.16/tests/expand/naming/struct-all.expanded.rs
@source-hash: fdfdb4d9c696ff91
@generated: 2026-02-09T18:03:21Z

## Purpose
Macro-expanded test file demonstrating pin-project-lite's code generation for a struct with both pinned and unpinned fields. Shows the complete generated projection infrastructure including safety mechanisms and trait implementations.

## Key Structures

### Original Struct (L2-5)
- `Struct<T, U>`: Generic struct with `pinned: T` and `unpinned: U` fields
- Serves as the base type for pin projection generation

### Generated Projection Types
- `StructProj<'__pin, T, U>` (L19-25): Mutable projection with pinned field as `Pin<&'__pin mut T>` and unpinned field as `&'__pin mut U`
- `StructProjRef<'__pin, T, U>` (L39-45): Immutable projection with pinned field as `Pin<&'__pin T>` and unpinned field as `&'__pin U`  
- `StructProjReplace<T, U>` (L58-61): Replace projection using `PhantomData<T>` for pinned field and direct `U` for unpinned field

## Core Methods (L73-128)

### project (L76-86)
- Takes `Pin<&'__pin mut Self>` and returns `StructProj<'__pin, T, U>`
- Uses unsafe `get_unchecked_mut()` and `Pin::new_unchecked()` for pinned field projection
- Direct mutable reference for unpinned field

### project_ref (L89-99)  
- Takes `Pin<&'__pin Self>` and returns `StructProjRef<'__pin, T, U>`
- Similar unsafe projection but for immutable references

### project_replace (L102-127)
- Complex replacement logic using `UnsafeOverwriteGuard` (L108-111)
- Reads unpinned field value while maintaining pinning invariants for pinned field
- Uses `UnsafeDropInPlaceGuard` for safe cleanup (L119-121)

## Safety Infrastructure

### __Origin Phantom Type (L130-134)
- Helper struct for Unpin analysis with `AlwaysUnpin<U>` wrapper for unpinned field
- Used in conditional Unpin implementation (L135-140)

### Drop Prevention (L141-144)
- `MustNotImplDrop` trait prevents manual Drop implementation on projected struct
- Ensures pin projection safety guarantees

### Repr Safety Check (L146-149)
- `__assert_not_repr_packed` function validates struct layout assumptions
- Takes references to all fields to ensure safe projection

## Dependencies
- `pin_project_lite`: Core projection functionality and private utilities
- Uses internal `__private` module for `Pin`, `PhantomData`, `UnsafeOverwriteGuard`, etc.

## Architecture Notes
- All generated code is `#[doc(hidden)]` to avoid public API exposure
- Extensive clippy allow lists for generated code patterns
- Leverages unsafe code with careful guard types for memory safety
- Phantom lifetimes (`'__pin`) ensure proper lifetime relationships