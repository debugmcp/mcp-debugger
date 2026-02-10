# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/pin-project-lite-0.2.16/tests/expand/default/enum.expanded.rs
@source-hash: a0e001a28bd060f5
@generated: 2026-02-09T18:02:30Z

## Pin-Project-Lite Macro-Generated Enum Test Code

This file contains macro-expanded Rust code demonstrating the output of the `pin_project` macro when applied to an enum. It's part of the test suite for the `pin-project-lite` crate.

### Original Enum
- `Enum<T, U>` (L2-5): Generic enum with two variants - `Struct` containing pinned/unpinned fields and `Unit` with no data

### Generated Projection Types
The macro generates three specialized projection enums:

- `EnumProj<'__pin, T, U>` (L19-28): Mutable projection where `pinned` field becomes `Pin<&mut T>` and `unpinned` becomes `&mut U`
- `EnumProjRef<'__pin, T, U>` (L42-51): Immutable projection where `pinned` becomes `Pin<&T>` and `unpinned` becomes `&U`  
- `EnumProjReplace<T, U>` (L64-67): Replacement projection using `PhantomData<T>` for pinned field

### Core Implementation Methods
Within the const block (L76-165), the macro generates:

- `project()` (L80-96): Converts `Pin<&mut Self>` to mutable projection `EnumProj`, using unsafe `Pin::new_unchecked()` for pinned fields
- `project_ref()` (L99-115): Converts `Pin<&Self>` to immutable projection `EnumProjRef`
- `project_replace()` (L118-147): Complex replacement operation using `UnsafeOverwriteGuard` and `UnsafeDropInPlaceGuard` for safe field replacement

### Pin Safety Infrastructure
- `__Origin<'__pin, T, U>` struct (L150-154): Phantom type for tracking pinning constraints
- Conditional `Unpin` implementation (L155-160): Only implements `Unpin` when pinned fields are `Unpin`
- Drop trait validation (L161-164): Ensures the original enum doesn't implement `Drop` to maintain pin safety

### Key Dependencies
- `pin_project_lite::__private`: Internal utilities for pin projection operations
- Uses unsafe operations with proper guards for memory safety during projections

The code demonstrates the complete machinery needed for safe pin projection on enums, ensuring pinned fields maintain their pinning guarantees across all projection operations.