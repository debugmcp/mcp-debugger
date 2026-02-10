# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/pin-project-lite-0.2.16/tests/expand/not_unpin/struct.rs
@source-hash: 99d77727393e4a05
@generated: 2026-02-09T18:02:34Z

**Purpose**: Test file demonstrating pin-project-lite macro expansion for structs with `!Unpin` projection, used to verify macro-generated code behaves correctly when the struct is explicitly NOT Unpin.

**Key Elements**:
- `Struct<T, U>` (L9-13): Generic struct with mixed pinning requirements - contains one pinned field (`pinned: T`) and one unpinned field (`unpinned: U`)
- `pin_project!` macro (L5-14): Generates projection types with custom names and explicit `!Unpin` constraint

**Macro Configuration**:
- `#[project = StructProj]` (L6): Custom name for owned projection type
- `#[project(!Unpin)]` (L7): Explicitly opts out of automatic Unpin implementation - critical for ensuring the struct remains pinned when any field requires pinning
- `#[project_ref = StructProjRef]` (L8): Custom name for reference projection type
- `#[pin]` attribute (L10): Marks `pinned` field as requiring structural pinning

**Dependencies**:
- `pin_project_lite` crate for macro functionality

**Testing Context**: This is an expansion test case verifying that the macro correctly handles the `!Unpin` directive, ensuring generated code doesn't automatically implement Unpin even when it might be safe to do so. The empty `main()` function (L16) suggests this is primarily for compile-time verification.