# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/pin-project-lite-0.2.16/tests/expand/naming/struct-none.rs
@source-hash: 05767cd68ec5cddc
@generated: 2026-02-09T18:02:29Z

**Primary Purpose**: Test file demonstrating basic `pin_project!` macro usage with default naming conventions (no custom projection names).

**Key Elements**:
- `Struct<T, U>` (L6-11): Generic struct with mixed pinned/unpinned fields, using `pin_project!` macro
  - `pinned: T` (L8): Field marked with `#[pin]` attribute, will be projected as pinned
  - `unpinned: U` (L9): Regular field, will be projected as unpinned reference
- `main()` (L13): Empty main function for compilation testing

**Dependencies**:
- `pin_project_lite::pin_project` (L3): Macro for generating projection types and implementations

**Architectural Patterns**:
- Uses `pin_project!` declarative macro to auto-generate projection structs and trait implementations
- Relies on default naming convention (no explicit `project = ` parameter)
- Test structure follows pin-project-lite's expand testing pattern for macro output verification

**Key Invariants**:
- Fields marked `#[pin]` maintain pinning guarantees in generated projections
- Unpinned fields become mutable references in projections
- Generated code provides safe pinned field access without manual `unsafe` blocks