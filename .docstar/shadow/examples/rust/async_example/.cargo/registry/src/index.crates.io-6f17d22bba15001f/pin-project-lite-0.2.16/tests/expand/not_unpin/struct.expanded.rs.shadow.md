# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/pin-project-lite-0.2.16/tests/expand/not_unpin/struct.expanded.rs
@source-hash: 3ba32743c7578aad
@generated: 2026-02-09T18:02:40Z

## Purpose
Expanded macro code from pin-project-lite crate showing the generated projection types and implementations for a struct with mixed pinned/unpinned fields. This is a test file demonstrating macro expansion output for the `not_unpin` test case.

## Key Structures

### Original Struct (L2-5)
- `Struct<T, U>`: Generic struct with `pinned: T` and `unpinned: U` fields
- Represents the user's input structure before macro expansion

### Generated Projection Types

#### StructProj (L19-25)
- Mutable projection type with lifetime `'__pin`
- `pinned` field wrapped in `Pin<&'__pin mut T>`  
- `unpinned` field as raw mutable reference `&'__pin mut U`

#### StructProjRef (L39-45)  
- Immutable projection type with lifetime `'__pin`
- `pinned` field wrapped in `Pin<&'__pin T>`
- `unpinned` field as raw reference `&'__pin U`

## Key Methods (L56-102)

### Projection Methods (L57-84)
- `project()` (L60-70): Creates mutable projection from `Pin<&mut Self>`, uses unsafe `get_unchecked_mut()`
- `project_ref()` (L73-83): Creates immutable projection from `Pin<&Self>`, uses unsafe `get_ref()`

### Pin Safety Implementation (L86-92)
- Custom `Unpin` implementation that prevents automatic `Unpin` derivation
- Uses `PhantomPinned` to ensure struct remains `!Unpin`

### Drop Safety (L93-96)
- `MustNotImplDrop` trait ensures the original struct doesn't implement `Drop`
- Prevents conflicts with pin projection semantics

### Memory Layout Safety (L98-101)
- `__assert_not_repr_packed()`: Compile-time check preventing `#[repr(packed)]` usage
- Uses `#[forbid(unaligned_references)]` to catch alignment issues

## Architectural Patterns
- **Pin Projection Pattern**: Safe projection of pinned data through generated types
- **Lifetime Parameterization**: `'__pin` lifetime ensures borrowed projections don't outlive the pin
- **Unsafe Encapsulation**: Unsafe operations isolated within generated methods with safe public APIs
- **Compile-time Safety Checks**: Multiple traits and functions prevent misuse

## Dependencies
- `pin_project_lite::__private`: Internal utilities for Pin manipulation and phantom types
- Standard library Pin types and unsafe operations

## Critical Invariants
- Pinned fields must remain pinned through projections
- Drop implementation forbidden on projected structs
- Memory layout must not use `#[repr(packed)]`
- Projections maintain pin guarantees through unsafe but verified operations