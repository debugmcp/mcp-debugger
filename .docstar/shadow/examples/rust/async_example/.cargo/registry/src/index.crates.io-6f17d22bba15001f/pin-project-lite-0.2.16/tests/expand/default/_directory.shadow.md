# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/pin-project-lite-0.2.16/tests/expand/default/
@generated: 2026-02-09T18:16:05Z

## Pin-Project-Lite Macro Expansion Test Suite - Default Projections

This directory contains test files demonstrating the default behavior of the `pin-project-lite` crate's macro system, specifically testing macro expansion for both struct and enum types with mixed pinned/unpinned fields.

### Purpose and Scope
The directory serves as a comprehensive test suite for verifying that the `pin_project!` macro generates correct Rust code for fundamental pin projection patterns. It validates both the source macro usage and the resulting expanded code to ensure pin safety guarantees are maintained.

### Key Components and Organization

**Source Test Files**:
- `struct.rs`: Basic struct example with pinned (`T`) and unpinned (`U`) fields
- `enum.rs`: Enum example with variants containing mixed field types and custom projection naming

**Macro Expansion Verification**:
- `struct.expanded.rs`: Complete macro-generated code for struct projections
- `enum.expanded.rs`: Complete macro-generated code for enum projections with custom projection types

### Generated Pin Projection Infrastructure

The macro expansion creates several critical components for each type:

**Projection Types**:
- Mutable projections (`Projection`/`EnumProj`) - convert pinned fields to `Pin<&mut T>`
- Immutable projections (`ProjectionRef`/`EnumProjRef`) - convert pinned fields to `Pin<&T>`  
- Replace projections (`EnumProjReplace`) - enable safe field replacement using `PhantomData`

**Core Methods**:
- `project()`: Safely converts `Pin<&mut Self>` to mutable field projections
- `project_ref()`: Safely converts `Pin<&Self>` to immutable field projections
- `project_replace()`: (enums only) Complex replacement operations with memory safety guards

**Pin Safety Guarantees**:
- Conditional `Unpin` implementations based on pinned field characteristics
- Compile-time checks preventing unsafe `Drop` implementations
- Memory layout validation (no `#[repr(packed)]`)
- Structural pinning maintenance across all projections

### Data Flow and Usage Pattern

1. **Macro Input**: Source types annotated with `#[pin]` attributes on fields requiring pinning
2. **Code Generation**: Macro generates projection types, safety infrastructure, and accessor methods
3. **Runtime Usage**: Safe field access through generated projection methods while maintaining pin invariants

### Test Architecture
This directory validates the "default" projection behavior where:
- Pin projection types use standard naming conventions
- All pin safety mechanisms are correctly implemented
- Both struct and enum patterns work correctly
- Macro expansion produces valid, safe Rust code

The tests ensure that the pin-project-lite macro correctly implements the complex unsafe operations needed for pin projections while maintaining Rust's memory safety guarantees through careful use of guards, phantom types, and conditional trait implementations.