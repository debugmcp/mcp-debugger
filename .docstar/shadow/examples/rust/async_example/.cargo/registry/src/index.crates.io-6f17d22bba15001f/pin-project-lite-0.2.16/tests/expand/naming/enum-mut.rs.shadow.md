# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/pin-project-lite-0.2.16/tests/expand/naming/enum-mut.rs
@source-hash: bf215d055b29a7f9
@generated: 2026-02-09T18:02:27Z

**Primary Purpose**: Test file for `pin-project-lite` crate demonstrating custom projection naming for mutable enum projections with mixed pinned/unpinned fields.

**Key Components**:
- `Enum<T, U>` (L7-14): Generic enum with two variants demonstrating pin projection patterns
  - `Struct` variant (L8-12): Contains both pinned field (`pinned: T`, L10) and unpinned field (`unpinned: U`, L11)
  - `Unit` variant (L13): Empty variant for completeness
- `pin_project!` macro invocation (L5-15) with `#[project = EnumProj]` attribute (L6) specifying custom projection type name
- `#[pin]` attribute (L9) marking the `pinned` field for pin projection

**Dependencies**:
- `pin_project_lite::pin_project` macro (L3)

**Architectural Pattern**: 
This is an expansion test file that verifies the macro generates correct code for custom-named mutable projections of enums containing both pinned and unpinned fields. The `EnumProj` name will be used for the generated projection type instead of the default naming convention.

**Test Context**: 
Part of the pin-project-lite test suite validating macro expansion behavior for enum projection naming scenarios. The empty `main()` function (L17) indicates this is likely compiled but not executed, serving as a compilation test.