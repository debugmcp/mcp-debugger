# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/pin-project-lite-0.2.16/tests/expand/multifields/
@generated: 2026-02-09T18:16:14Z

## Purpose and Scope

This directory contains macro expansion test cases for `pin_project_lite`'s handling of multi-field data structures. It serves as part of the crate's test suite to verify correct code generation when the `pin_project` macro is applied to structs and enums containing multiple pinned and unpinned fields.

## Directory Organization

The directory follows a paired test structure with source/expanded file pairs:

### Test Cases
- **struct.rs / struct.expanded.rs**: Tests `pin_project` macro expansion for structs with multiple mixed fields
- **enum.rs / enum.expanded.rs**: Tests `pin_project` macro expansion for enums with multi-field struct variants

### Test Pattern
Each `.rs` file contains the original macro-annotated code, while the corresponding `.expanded.rs` file shows the complete macro-generated output that the compiler actually processes.

## Key Components and Architecture

### Input Structures (Source Files)
Both test cases use generic types `<T, U>` with mixed field pinning:
- **Pinned fields** (type `T`): Marked with `#[pin]` attribute, become `Pin<&mut T>` in projections
- **Unpinned fields** (type `U`): Regular fields that become `&mut U` in projections
- **Project Replace**: Both tests specify custom replacement projection types

### Generated Infrastructure (Expanded Files)

**Projection Types**:
- `Projection<'pin, T, U>`: Mutable projections with `Pin<&mut T>` for pinned, `&mut U` for unpinned fields
- `ProjectionRef<'pin, T, U>`: Immutable projections with `Pin<&T>` for pinned, `&U` for unpinned fields  
- `*ProjReplace<T, U>`: Replacement projections using `PhantomData<T>` markers for moved pinned fields

**Core Methods**:
- `project()`: Creates mutable projections via unsafe pin operations
- `project_ref()`: Creates immutable projections
- `project_replace()`: Complex field replacement using safety guards (`UnsafeOverwriteGuard`, `UnsafeDropInPlaceGuard`)

**Safety Infrastructure**:
- `__Origin<T, U>`: Helper type for Unpin analysis using `AlwaysUnpin<U>` wrappers
- `MustNotImplDrop`: Compile-time trait preventing manual Drop implementations
- Memory layout validation preventing `#[repr(packed)]` usage

## Data Flow and Interaction

1. **Macro Processing**: `pin_project!` macro analyzes field annotations and generates projection infrastructure
2. **Projection Creation**: Methods safely construct typed projections from raw struct/enum references
3. **Pin Safety**: Conditional Unpin implementation ensures types are only Unpin when all pinned fields are Unpin
4. **Memory Safety**: Guard types and compile-time checks prevent undefined behavior during field replacement

## Testing Strategy

This directory validates that `pin_project_lite` correctly handles:
- **Multiple pinned fields** in the same data structure
- **Mixed pinned/unpinned field combinations**
- **Generic type parameters** with different pinning requirements
- **Complex enum variants** with struct-like field collections
- **Project-replace functionality** for advanced pin manipulation patterns

## Dependencies

- `pin_project_lite`: Core macro and safety primitives (`Pin`, `PhantomData`, guard types)
- Standard library: Pointer operations, memory layout utilities

The directory serves as a comprehensive validation suite ensuring the macro generates correct, safe, and efficient code for multi-field pin projection scenarios.