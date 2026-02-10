# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/pin-project-lite-0.2.16/tests/expand/pub/enum.rs
@source-hash: fdbd806e92cfad4e
@generated: 2026-02-09T18:02:36Z

**Primary Purpose:** Test file demonstrating pin-project-lite macro expansion for a public generic enum with mixed pinned/unpinned fields.

**Core Components:**
- `Enum<T, U>` (L8-15): Public generic enum with two variants showcasing pin projection capabilities
  - `Struct` variant (L9-13): Contains both pinned (`pinned: T`, L11) and unpinned (`unpinned: U`, L12) fields
  - `Unit` variant (L14): Empty variant for completeness testing

**Key Dependencies:**
- `pin_project_lite::pin_project` (L3): Macro for generating safe pin projections without proc-macro dependencies

**Architectural Patterns:**
- **Pin Projection Testing**: Uses `#[project = EnumProj]` and `#[project_ref = EnumProjRef]` (L6-7) to generate projection types for safe pin manipulation
- **Mixed Field Safety**: Demonstrates selective pinning with `#[pin]` attribute (L10) on only one field while leaving others unpinned
- **Generic Type Support**: Tests macro's ability to handle generic parameters `<T, U>` in enum definitions

**Generated Behavior:**
The macro generates `EnumProj` and `EnumProjRef` projection enums that allow safe access to pinned and unpinned fields without violating Rust's pin safety guarantees.

**Test Context:**
- Located in `/expand/pub/` indicating this tests public visibility with macro expansion
- `main()` function (L18) serves as compilation test entry point
- Part of pin-project-lite's test suite verifying correct code generation