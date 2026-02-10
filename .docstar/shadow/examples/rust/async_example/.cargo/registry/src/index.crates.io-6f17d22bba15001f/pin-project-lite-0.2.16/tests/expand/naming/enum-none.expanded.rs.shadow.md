# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/pin-project-lite-0.2.16/tests/expand/naming/enum-none.expanded.rs
@source-hash: 6c00c1ab0d340fe7
@generated: 2026-02-09T18:02:32Z

## Purpose
Expanded macro output test file for `pin_project_lite` demonstrating generated code for enum types without custom projection naming. This file shows the complete macro expansion result when applying `pin_project` to an enum.

## Key Components

**Primary Enum (L2-5)**
- `Enum<T, U>`: Generic enum with two variants
  - `Struct { pinned: T, unpinned: U }`: Named fields variant with mixed pin semantics
  - `Unit`: Unit variant with no fields

**Generated Implementation Block (L14-32)**
- Main const block containing all macro-generated code
- `impl<T, U> Enum<T, U> {}` (L15): Empty implementation for the original enum

**Pin Projection Infrastructure (L17-27)**
- `__Origin<'__pin, T, U>` (L17-21): Internal struct modeling pinned field relationships
  - `__dummy_lifetime`: Lifetime phantom data for pin safety
  - `Struct`: Tuple representing struct variant fields with pin annotations
  - `Unit`: Unit type for unit variant
- Custom `Unpin` implementation (L22-27): Conditional unpin based on pinned fields

**Drop Safety Mechanism (L28-31)**
- `MustNotImplDrop` trait (L28): Ensures the enum doesn't implement `Drop`
- Blanket implementation (L30) prevents `Drop` implementations
- Specific implementation for `Enum<T, U>` (L31) enforces the constraint

**Test Entry Point (L33)**
- `main()`: Empty function for compilation testing

## Dependencies
- `pin_project_lite`: Core macro library for safe pin projection
- Standard library phantom data and unpin mechanisms

## Architectural Patterns
- **Macro Expansion**: Demonstrates complete code generation from `pin_project` macro
- **Pin Safety**: Uses phantom types and conditional bounds for memory safety
- **Drop Prevention**: Trait-based mechanism prevents unsafe drop implementations
- **Variant Modeling**: Internal struct mirrors enum variants for projection logic

## Critical Constraints
- The enum cannot implement `Drop` due to pin safety requirements
- Unpin behavior depends on whether pinned fields are themselves `Unpin`
- Generated code uses internal `__private` APIs not meant for direct consumption