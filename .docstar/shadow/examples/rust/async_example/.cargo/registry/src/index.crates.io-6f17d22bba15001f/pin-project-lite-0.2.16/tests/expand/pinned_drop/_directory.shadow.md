# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/pin-project-lite-0.2.16/tests/expand/pinned_drop/
@generated: 2026-02-09T18:16:06Z

## Purpose
Test directory validating `pin-project-lite` macro expansion for types with custom pinned drop handlers. Demonstrates the complete code generation pipeline from source macros to expanded implementations, ensuring correctness of pin projection patterns combined with custom drop semantics.

## Key Components

### Test Source Files
- **`struct.rs`**: Source test case showing `pin_project!` macro usage on structs with `PinnedDrop` implementation
- **`enum.rs`**: Source test case demonstrating macro application to enums with mixed pinned/unpinned variants and custom drop logic

### Expanded Reference Files  
- **`struct.expanded.rs`**: Complete macro expansion output for struct case, showing generated projection types, unsafe implementations, and pin safety infrastructure
- **`enum.expanded.rs`**: Complete macro expansion output for enum case, demonstrating variant projection handling and drop semantics

## Architecture & Data Flow

### Macro Expansion Pipeline
1. **Source Definition**: Types annotated with `pin_project!` macro and `PinnedDrop` trait
2. **Code Generation**: Macro produces projection types (`Proj`/`ProjRef`), implementation methods, and safety infrastructure
3. **Validation**: Expanded files serve as reference implementations for testing macro output correctness

### Generated API Surface
- **Projection Types**: `*Proj<'__pin, T, U>` (mutable) and `*ProjRef<'__pin, T, U>` (immutable) for safe field access
- **Projection Methods**: `project()` and `project_ref()` methods for converting pinned references to field projections
- **Pin Safety**: Conditional `Unpin` implementations and compile-time assertions preventing unsafe patterns
- **Custom Drop**: Integration of user-defined drop logic via `PinnedDrop::drop(Pin<&mut Self>)`

## Critical Patterns

### Pin Safety Guarantees
- All projections use carefully controlled `unsafe` code with `Pin::new_unchecked()`
- Generated `Unpin` implementations analyze field requirements automatically  
- Compile-time guards prevent `#[repr(packed)]` and other unsafe patterns

### Drop Semantics
- Custom `Drop` implementation creates pinned self-reference for `__drop_inner()` calls
- Preserves pin invariants during destruction while allowing user customization
- Handles both struct and enum cases with appropriate variant matching

### Test Coverage
- Validates macro expansion for both struct and enum types
- Covers mixed pinned/unpinned field scenarios
- Ensures generated code compiles and maintains safety invariants
- Provides reference implementations for regression testing

## Dependencies
- `pin_project_lite` crate for core macro functionality
- `pin_project_lite::__private` module for internal pin utilities and type helpers

This directory serves as a comprehensive test suite ensuring that `pin-project-lite`'s code generation correctly handles the complex interaction between pin projections and custom drop implementations across different type structures.