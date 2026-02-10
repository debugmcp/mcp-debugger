# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/pin-project-lite-0.2.16/tests/expand/naming/struct-mut.rs
@source-hash: 36edd8db816c122c
@generated: 2026-02-09T18:03:12Z

**Purpose**: Test file demonstrating custom projection naming for pin-project-lite macro with struct containing both pinned and unpinned fields.

**Key Components**:
- `Struct<T, U>` (L7-11): Generic struct with mixed field pinning
  - `pinned: T` (L9): Field marked with `#[pin]` attribute for Pin projection
  - `unpinned: U` (L10): Regular field not subject to pinning constraints
- `pin_project!` macro (L5-12): Generates projection with custom name `StructProj` via `#[project = StructProj]`

**Dependencies**:
- `pin_project_lite` crate for the `pin_project` procedural macro

**Architecture Notes**:
- Tests custom naming feature of pin-project-lite where projection struct gets explicit name rather than default
- Demonstrates mixed pinning scenario - common pattern for structs containing both owned and borrowed/pinned data
- Empty `main()` function (L14) indicates this is a compile-time test focusing on macro expansion correctness

**Generated Code Expectations**:
The macro will generate a `StructProj` projection type that allows safe field access while maintaining Pin guarantees for the `pinned` field.