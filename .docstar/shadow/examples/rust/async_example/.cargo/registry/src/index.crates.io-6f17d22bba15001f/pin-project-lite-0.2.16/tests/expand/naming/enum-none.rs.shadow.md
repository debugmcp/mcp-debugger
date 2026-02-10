# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/pin-project-lite-0.2.16/tests/expand/naming/enum-none.rs
@source-hash: 115968816e1a1a6b
@generated: 2026-02-09T18:02:27Z

**Primary Purpose:** Test file demonstrating pin-project-lite macro usage with enum variants, specifically testing the "none" naming configuration for projection types.

**Key Elements:**
- `Enum<T, U>` (L6-13): Generic enum with two variants showcasing pin projection capabilities
  - `Struct` variant (L7-11): Contains both pinned (`pinned: T`) and unpinned (`unpinned: U`) fields
  - `Unit` variant (L12): Empty variant for completeness
- `#[pin]` attribute (L8): Marks the `pinned` field for pin projection
- `main()` function (L16): Empty main function required for test compilation

**Dependencies:**
- `pin_project_lite` crate: Provides the `pin_project!` macro for safe pin projection

**Architectural Notes:**
- Part of pin-project-lite's test suite under `/tests/expand/naming/` directory structure
- Tests macro expansion behavior when no custom projection names are specified ("none" configuration)
- Demonstrates mixed field types (pinned vs unpinned) in enum variants
- Uses dual licensing (Apache-2.0 OR MIT)

**Testing Context:**
This file likely serves as input for macro expansion testing, verifying that pin-project-lite correctly generates projection code for enums with default naming when no custom names are provided.