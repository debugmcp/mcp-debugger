# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/pin-project-lite-0.2.16/tests/expand/naming/enum-ref.rs
@source-hash: e09ce2ca812b9fcf
@generated: 2026-02-09T18:03:16Z

## Primary Purpose
Test file demonstrating custom naming for enum projection references using `pin-project-lite`. This file validates that the `#[project_ref = EnumProjRef]` attribute correctly generates a custom-named reference projection type.

## Key Components

### Enum Definition (L5-15)
- **Enum<T, U>** (L7): Generic enum with two variants demonstrating pin projection patterns
- **Struct variant** (L8-12): Contains both pinned (`#[pin] pinned: T`) and unpinned (`unpinned: U`) fields
- **Unit variant** (L13): Simple unit variant with no fields
- **Custom projection naming** (L6): `#[project_ref = EnumProjRef]` attribute specifies custom name for reference projection

### Dependencies
- `pin_project_lite::pin_project` (L3): Macro for generating safe pin projections

## Architectural Pattern
This follows the pin-project-lite test pattern where:
1. An enum is annotated with `pin_project!` macro
2. Custom projection reference naming is specified via `#[project_ref = ...]`
3. Fields are selectively marked as `#[pin]` to participate in pin projection
4. The generated `EnumProjRef` type provides safe access to pinned references

## Generated Behavior
The macro generates projection methods that return `EnumProjRef` (instead of default naming) with safe pinned access to the `pinned` field while providing normal references to `unpinned` fields.

## Test Context
This is an expansion test file that likely gets processed to verify correct macro expansion output, particularly focusing on custom reference projection naming conventions.