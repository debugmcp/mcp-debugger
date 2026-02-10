# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/pin-project-lite-0.2.16/tests/expand/naming/struct-ref.rs
@source-hash: dd249875f962d16d
@generated: 2026-02-09T18:02:33Z

**Primary Purpose**
Test case for pin-project-lite's naming functionality, specifically demonstrating custom naming of projection reference types through the `project_ref` attribute.

**Key Components**
- `Struct<T, U>` (L7-11): Generic struct with mixed pinned/unpinned fields used as test subject for pin projection
- `pin_project!` macro invocation (L5-12): Generates projection types with custom reference projection naming
- `#[project_ref = StructProjRef]` (L6): Custom attribute specifying the name for the reference projection type
- `pinned: T` field (L9): Pinned field marked with `#[pin]` attribute
- `unpinned: U` field (L10): Standard unpinned field
- `main()` function (L14): Empty entry point required for compilation

**Dependencies**
- `pin_project_lite::pin_project` (L3): Core macro for generating pin projections

**Architectural Patterns**
- Declarative macro usage for code generation
- Custom type naming through attributes
- Mixed field types (pinned vs unpinned) in single struct
- Test-driven design pattern (minimal executable test case)

**Purpose in Context**
This is a focused test case within the pin-project-lite crate's test suite, specifically validating that the `project_ref` attribute correctly generates custom-named reference projection types. The generated code would create a `StructProjRef` type alongside the default projections, allowing users to customize projection type names for better API ergonomics.