# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/pin-project-lite-0.2.16/tests/expand/naming/struct-all.rs
@source-hash: 0d6b64bc687fbc19
@generated: 2026-02-09T18:03:12Z

**Purpose**: Test case for pin-project-lite macro demonstrating comprehensive projection naming configuration with all projection types specified.

**Key Components**:
- `pin_project!` macro invocation (L5-14): Generates projection types for a generic struct with custom naming
- `Struct<T, U>` definition (L9-13): Generic struct with mixed pinning requirements
  - `pinned: T` field (L11): Pin-projected field marked with `#[pin]`
  - `unpinned: U` field (L12): Non-pinned field, moved by value in projections

**Macro Configuration**:
- `#[project = StructProj]` (L6): Names the owned projection type
- `#[project_ref = StructProjRef]` (L7): Names the borrowed projection type  
- `#[project_replace = StructProjReplace]` (L8): Names the replacement projection type

**Generated Types**: The macro generates three projection enums:
- `StructProj<T, U>`: For owned projections with `Pin<&mut T>` and `U`
- `StructProjRef<T, U>`: For borrowed projections with `Pin<&T>` and `&U`
- `StructProjReplace<U>`: For replacement projections with `U` (pinned fields consumed)

**Dependencies**: 
- `pin_project_lite` crate for the procedural macro

**Architecture**: Expansion test validating that pin-project-lite correctly handles explicit naming of all three projection types rather than using default names. The `main()` function (L16) serves only as a compilation target.