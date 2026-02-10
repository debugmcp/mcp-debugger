# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/pin-project-lite-0.2.16/tests/expand/not_unpin/
@generated: 2026-02-09T18:16:10Z

## Purpose
This directory contains **expansion tests** for the `pin-project-lite` crate that validate macro-generated code for types explicitly marked with `!Unpin`. These tests ensure that the pin projection macro correctly handles scenarios where types should NOT automatically implement `Unpin`, maintaining strict pin safety guarantees.

## Core Architecture

### Test Structure Pattern
Each test follows a paired structure:
- **Source files** (`.rs`): Original code using `pin_project!` macro with `!Unpin` directive
- **Expansion files** (`.expanded.rs`): Expected macro-generated code for comparison

### Key Test Cases

#### Struct Tests (`struct.rs` / `struct.expanded.rs`)
Tests pin projection for structs with mixed field pinning:
- `Struct<T, U>` with `#[pin]` on `pinned: T` field and regular `unpinned: U` field
- Validates `StructProj` and `StructProjRef` generation with proper pin wrapping
- Ensures `!Unpin` prevents automatic `Unpin` implementation

#### Enum Tests (`enum.rs` / `enum.expanded.rs`) 
Tests pin projection for enums with selective field pinning:
- `Enum<T, U>` with `Struct` variant containing mixed pinned/unpinned fields
- Validates `EnumProj` and `EnumProjRef` generation for variant projections
- Ensures enum-level `!Unpin` behavior

## Generated Code Components

### Projection Types
- **Mutable Projections** (`*Proj`): Transform pinned fields to `Pin<&mut T>`, unpinned to `&mut T`
- **Immutable Projections** (`*ProjRef`): Transform pinned fields to `Pin<&T>`, unpinned to `&T`
- **Lifetime Safety**: All projections use `'__pin` lifetime tied to original pinned reference

### Safety Mechanisms
- **Pin Safety**: `project()` and `project_ref()` methods use `unsafe` operations with proper encapsulation
- **Unpin Prevention**: Custom `Unpin` implementation using `PhantomPinned` to maintain `!Unpin`
- **Drop Safety**: `MustNotImplDrop` trait prevents conflicting `Drop` implementations
- **Layout Safety**: Compile-time checks prevent `#[repr(packed)]` usage

## Key Patterns

### Macro Configuration
```rust
#[pin_project]
#[project(!Unpin)]           // Explicit !Unpin directive
#[project = CustomProj]      // Custom projection type name
#[project_ref = CustomProjRef] // Custom reference projection name
```

### Field-Level Control
```rust
struct Example<T, U> {
    #[pin] pinned_field: T,    // Requires structural pinning
    normal_field: U,           // Regular field access
}
```

## Testing Significance
This directory validates critical safety invariants:
- Types marked `!Unpin` never automatically implement `Unpin`
- Pin projections maintain memory safety through all transformations  
- Generated code properly handles both struct and enum variants
- Unsafe operations remain properly encapsulated within safe APIs

The expansion tests serve as both validation and documentation of the exact code generation behavior, ensuring pin-project-lite maintains its safety guarantees across different type structures.