# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/pin-project-lite-0.2.16/tests/expand/not_unpin/enum.expanded.rs
@source-hash: 1c2dde8ff53bff07
@generated: 2026-02-09T18:02:36Z

This is a **macro-expanded test file** from the `pin-project-lite` crate that demonstrates the generated code for an enum with selective pinning. It serves as a reference for the macro expansion output in test scenarios where `!Unpin` behavior is expected.

## Core Components

### Original Enum (L2-5)
- `Enum<T, U>`: Generic enum with two variants
  - `Struct { pinned: T, unpinned: U }`: Contains both pinned and unpinned fields
  - `Unit`: Empty variant

### Generated Projection Types
- **EnumProj<'__pin, T, U>** (L19-28): Mutable projection enum
  - `Struct` variant wraps `pinned` field in `Pin<&mut T>`, leaves `unpinned` as `&mut U`
  - Uses lifetime `'__pin` to tie projections to original pinned reference
  
- **EnumProjRef<'__pin, T, U>** (L42-51): Immutable projection enum
  - Similar structure but with `Pin<&T>` and `&T` for immutable access

### Implementation Block (L61-113)
- **project()** (L64-80): Converts `Pin<&mut Self>` to mutable projection
  - Uses `unsafe` and `get_unchecked_mut()` for performance
  - Wraps pinned fields in `Pin::new_unchecked()`
  
- **project_ref()** (L83-99): Converts `Pin<&Self>` to immutable projection
  - Uses `get_ref()` and similar unsafe pinning logic

### Unpin Implementation (L102-108)
- Conditional `Unpin` implementation that requires `PhantomPinned` to be `Unpin`
- This creates the `!Unpin` behavior since `PhantomPinned` is never `Unpin`

### Drop Safety (L109-112)
- `MustNotImplDrop` trait prevents manual `Drop` implementation
- Ensures drop safety invariants for pinned types

## Key Patterns
- Extensive clippy lint suppression for generated code
- `#[doc(hidden)]` on all generated items
- Phantom lifetime constraints for projection safety
- Unsafe pinning operations with proper encapsulation