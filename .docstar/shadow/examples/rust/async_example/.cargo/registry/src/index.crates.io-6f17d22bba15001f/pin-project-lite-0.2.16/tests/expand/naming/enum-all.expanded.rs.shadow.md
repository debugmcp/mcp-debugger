# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/pin-project-lite-0.2.16/tests/expand/naming/enum-all.expanded.rs
@source-hash: a0e001a28bd060f5
@generated: 2026-02-09T18:03:19Z

## pin-project-lite Macro Expansion Test File

This file demonstrates the expanded output of the `pin_project_lite::pin_project` macro applied to an enum with both struct and unit variants. It serves as a test case for the macro's code generation capabilities.

### Core Components

**Original Enum (L2-5)**: `Enum<T, U>` with two variants:
- `Struct { pinned: T, unpinned: U }` - Contains both pinned and unpinned fields
- `Unit` - Unit variant with no fields

**Generated Projection Types**:
- `EnumProj<'__pin, T, U>` (L19-28) - Mutable projection with `Pin<&mut T>` for pinned fields
- `EnumProjRef<'__pin, T, U>` (L42-51) - Immutable projection with `Pin<&T>` for pinned fields  
- `EnumProjReplace<T, U>` (L64-67) - Replacement projection using `PhantomData<T>` for pinned fields

### Key Methods (L77-148)

**`project()` (L80-96)**: Converts `Pin<&mut Self>` to `EnumProj`, creating pinned references to designated fields using `Pin::new_unchecked()`

**`project_ref()` (L99-115)**: Converts `Pin<&Self>` to `EnumProjRef` for immutable projections

**`project_replace()` (L118-147)**: Complex replacement operation using:
- `UnsafeOverwriteGuard` (L124-127) for safe replacement
- `UnsafeDropInPlaceGuard` (L136-138) for proper cleanup of pinned fields
- Raw pointer manipulation for in-place operations

### Pin Safety Infrastructure

**`__Origin` struct (L150-154)**: Type-level representation encoding pinning constraints for each enum variant

**Unpin Implementation (L155-160)**: Conditional auto-trait implementation based on `PinnedFieldsOf` constraint

**Drop Safety (L161-164)**: `MustNotImplDrop` trait prevents manual Drop implementations that could violate pin guarantees

### Architecture Notes

- Extensive clippy allow attributes suppress lints on generated code
- All projection methods marked `#[doc(hidden)]` and `#[inline]` 
- Uses `unsafe` blocks with careful invariant preservation
- Phantom types and guards ensure memory safety during complex operations
- Empty `main()` function (L166) indicates this is a test expansion file