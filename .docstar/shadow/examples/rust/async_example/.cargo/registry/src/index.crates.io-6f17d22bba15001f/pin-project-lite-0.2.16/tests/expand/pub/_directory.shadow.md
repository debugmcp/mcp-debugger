# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/pin-project-lite-0.2.16/tests/expand/pub/
@generated: 2026-02-09T18:16:11Z

## Overall Purpose

This directory contains test cases demonstrating pin-project-lite's macro expansion for **public** types (structs and enums). It serves as both a verification suite and reference implementation showing how the `pin_project!` macro transforms user code into safe pin projection patterns while maintaining public API visibility.

## Key Components and Architecture

### Source and Expanded Pairs
The directory follows a pattern of **source-expansion pairs**:
- `struct.rs` + `struct.expanded.rs`: Public struct with mixed pinned/unpinned fields
- `enum.rs` + `enum.expanded.rs`: Public enum with variants containing both pinned and unpinned fields

### Core Test Structures

**Struct<T, U>**: Generic struct demonstrating basic pin projection
- `pinned: T` field marked with `#[pin]` - becomes projection-pinned
- `unpinned: U` field - remains movable in projections

**Enum<T, U>**: Generic enum showcasing variant-based pin projection
- `Struct` variant with mixed pinned/unpinned fields
- `Unit` variant for completeness testing

## Generated API Surface

### Projection Types
- **Mutable Projections**: `Projection<'__pin, T, U>` (struct), `EnumProj<'__pin, T, U>` (enum)
  - Pinned fields: `Pin<&'__pin mut T>`
  - Unpinned fields: `&'__pin mut U`

- **Immutable Projections**: `ProjectionRef<'__pin, T, U>`, `EnumProjRef<'__pin, T, U>`
  - Pinned fields: `Pin<&'__pin T>`
  - Unpinned fields: `&'__pin U`

### Core Methods
- `project(Pin<&mut Self>) -> MutableProjection` - Safe mutable field access
- `project_ref(Pin<&Self>) -> ImmutableProjection` - Safe immutable field access

## Internal Organization and Data Flow

### Pin Safety Infrastructure
1. **Phantom Types** (`__Origin`): Compile-time analysis of Unpin requirements
2. **Automatic Unpin Implementation**: Conditional based on pinned field types
3. **Drop Safety**: `MustNotImplDrop` trait prevents unsafe Drop implementations
4. **Memory Layout Safety**: `__assert_not_repr_packed` prevents alignment issues

### Unsafe Encapsulation Pattern
- All unsafe operations isolated within generated projection methods
- Uses `get_unchecked_mut()` and `Pin::new_unchecked()` for performance
- Maintains safety invariants through compile-time verification

## Important Patterns and Conventions

### Selective Pinning
- Uses `#[pin]` attribute to mark specific fields for pin projection
- Non-pinned fields remain normally accessible through projections
- Supports mixed pinning patterns within single types

### Lifetime Management
- Phantom lifetime `'__pin` ties projection lifetime to original Pin
- Ensures borrowed projections cannot outlive the pinned source

### Lint Suppression Strategy
- Extensive `#[allow(...)]` attributes on generated code
- Permits patterns that would normally trigger warnings in hand-written code
- Maintains clean compilation for macro-generated implementations

## Public API Guarantees

This directory specifically tests **public visibility** scenarios, ensuring:
- All generated types maintain public accessibility
- Generic parameters are properly forwarded
- Pin safety guarantees work correctly with public APIs
- Integration with external crates using public pin-projected types

The expanded files serve as ground truth for expected macro output, while source files provide minimal examples for testing the macro's transformation capabilities.