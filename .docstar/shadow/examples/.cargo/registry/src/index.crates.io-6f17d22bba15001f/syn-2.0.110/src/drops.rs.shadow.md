# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/syn-2.0.110/src/drops.rs
@source-hash: e98da4aaafb5afc7
@generated: 2026-02-09T18:12:11Z

## Purpose
Provides a zero-cost abstraction for wrapping types that don't need their destructors called, optimizing memory safety and performance in the syn parsing library.

## Core Components

### NoDrop<T> (L8-30)
A `#[repr(transparent)]` wrapper around `ManuallyDrop<T>` that prevents automatic drop execution for wrapped values.

**Key Methods:**
- `new(value: T) -> Self` (L11-16): Constructor requiring `T: TrivialDrop` constraint
- `Deref` implementation (L19-24): Provides transparent access to wrapped value
- `DerefMut` implementation (L26-30): Provides mutable access to wrapped value

### TrivialDrop Trait (L32)
Marker trait indicating types that don't require destructors to run. Acts as a compile-time safety constraint.

**Implementations (L34-38):**
- `iter::Empty<T>`
- `slice::Iter<'_, T>`  
- `slice::IterMut<'_, T>`
- `option::IntoIter<&T>`
- `option::IntoIter<&mut T>`

## Architecture Pattern
Implements the "trivial drop optimization" pattern where certain iterator types are known to have no-op destructors, allowing safe use of `ManuallyDrop` to avoid unnecessary drop glue in performance-critical parsing scenarios.

## Dependencies
- `std::mem::ManuallyDrop`: Core primitive for manual memory management
- Standard library iterator and slice types for trait implementations

## Test Coverage
Comprehensive test (L40-58) validates that standard library iterators are correctly identified as not needing drop, while custom types with Drop impls are properly detected.