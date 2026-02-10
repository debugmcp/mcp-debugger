# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/pin-project-lite-0.2.16/tests/expand/default/enum.rs
@source-hash: ebe6b6403e354594
@generated: 2026-02-09T18:02:27Z

**Purpose**: Test file demonstrating pin-project-lite macro usage with enum types, showcasing projection generation for variants with pinned fields.

**Key Components**:
- `Enum<T, U>` (L9-16): Generic enum with two variants demonstrating pin projection capabilities
  - `Struct` variant (L10-14): Contains both pinned (`T`) and unpinned (`U`) fields
  - `Unit` variant (L15): Simple unit variant with no fields
- `pin_project!` macro (L5-17): Generates projection types with custom names:
  - `EnumProj` for mutable projections
  - `EnumProjRef` for immutable projections  
  - `EnumProjReplace` for replacement projections

**Dependencies**:
- `pin_project_lite` crate for the `pin_project!` macro (L3)

**Architecture Notes**:
- Uses explicit projection type naming via `#[project]`, `#[project_ref]`, and `#[project_replace]` attributes
- The `#[pin]` attribute on `pinned` field (L11) indicates this field should be projected as `Pin<&mut T>` in mutable projections
- Demonstrates mixed pinned/unpinned field handling within enum variants
- `main()` function (L19) exists only to make this a valid Rust program for testing

**Context**: This is an expand test file, likely used to verify the macro generates correct code for enum projections with custom naming.