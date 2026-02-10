# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/pin-project-lite-0.2.16/tests/expand/pub/struct.expanded.rs
@source-hash: 9e84c170b1e6505f
@generated: 2026-02-09T18:02:42Z

## Purpose and Context

This file is an **expanded macro output** from `pin-project-lite`, demonstrating how the `pin_project!` macro transforms a simple struct with pinned fields. It serves as a test case showing the complete generated code for a public struct with both pinned and unpinned fields.

## Core Structure

**Struct<T, U> (L2-5)**: Original user-defined struct with two fields:
- `pinned: T` - field that will be pinned in memory
- `unpinned: U` - field that remains movable

## Generated Projection Types

**Projection<'__pin, T, U> (L30-36)**: Mutable projection struct providing:
- `pinned`: `Pin<&'__pin mut T>` - pinned mutable reference to T
- `unpinned`: `&'__pin mut U` - regular mutable reference to U

**ProjectionRef<'__pin, T, U> (L50-56)**: Immutable projection struct providing:
- `pinned`: `Pin<&'__pin T>` - pinned immutable reference to T  
- `unpinned`: `&'__pin U` - regular immutable reference to U

## Core Implementation Methods

**project() (L60-70)**: Converts `Pin<&mut Self>` to mutable projection
- Uses unsafe `get_unchecked_mut()` for field access
- Wraps pinned field with `Pin::new_unchecked()`
- Returns direct reference to unpinned field

**project_ref() (L73-83)**: Converts `Pin<&Self>` to immutable projection  
- Uses `get_ref()` for safe field access
- Same pinning logic but for immutable references

## Pin Safety Infrastructure

**__Origin<'__pin, T, U> (L86-90)**: Phantom type for Unpin analysis
- Contains `T` directly (must be Unpin if struct is Unpin)
- Wraps `U` in `AlwaysUnpin<U>` (always considered Unpin)
- Used by auto-generated Unpin impl (L91-96)

**Drop Safety (L97-100)**: Ensures struct doesn't implement Drop
- `MustNotImplDrop` trait prevents Drop implementation
- Critical for pin projection safety guarantees

**Memory Layout Safety (L102-105)**: `__assert_not_repr_packed` function
- Ensures struct is not `#[repr(packed)]`
- Takes references to all fields to detect alignment issues
- Decorated with `#[forbid(unaligned_references, safe_packed_borrows)]`

## Key Dependencies

- `pin_project_lite` crate for Pin utilities
- Uses internal `__private` module for implementation details
- Relies on `PhantomData`, `AlwaysUnpin`, `PinnedFieldsOf` types

## Architectural Patterns

- **Phantom lifetime `'__pin`**: Ties projection lifetime to original Pin
- **Unsafe projection**: Uses unchecked operations with compile-time safety guarantees
- **Trait-based constraints**: Leverages type system for pin safety verification
- **Extensive lint suppression**: Allows generated code patterns that would normally trigger warnings