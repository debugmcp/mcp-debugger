# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/pin-project-lite-0.2.16/tests/expand/naming/enum-all.rs
@source-hash: ebe6b6403e354594
@generated: 2026-02-09T18:02:29Z

## Purpose
Test file demonstrating pin-project-lite macro expansion with custom projection type naming for enums. Part of the pin-project-lite crate's test suite to verify macro code generation with all projection variants specified.

## Key Components

**Main Enum Definition (L5-17)**
- `Enum<T, U>` - Generic enum with two variants using `pin_project!` macro
- Custom projection names via attributes:
  - `#[project = EnumProj]` (L6) - Mutable projection type name
  - `#[project_ref = EnumProjRef]` (L7) - Immutable reference projection type name  
  - `#[project_replace = EnumProjReplace]` (L8) - Replace projection type name

**Enum Variants**
- `Struct` variant (L10-14) - Contains both pinned (`T`) and unpinned (`U`) fields
  - `pinned: T` field marked with `#[pin]` attribute (L11-12)
  - `unpinned: U` field without pin attribute (L13)
- `Unit` variant (L15) - Empty unit variant

**Dependencies**
- `pin_project_lite::pin_project` macro (L3) - Core macro for generating projection types

## Architecture Notes
- Test demonstrates comprehensive projection naming customization
- Validates macro expansion handles mixed pinned/unpinned fields in struct variants
- Empty `main()` function (L19) indicates this is a compilation test rather than runtime test
- Generic parameters `<T, U>` test macro's handling of generic enums

## Generated Behavior
The macro will generate three projection enums (`EnumProj`, `EnumProjRef`, `EnumProjReplace`) that mirror the original enum structure but with appropriate Pin wrappers for pinned fields.