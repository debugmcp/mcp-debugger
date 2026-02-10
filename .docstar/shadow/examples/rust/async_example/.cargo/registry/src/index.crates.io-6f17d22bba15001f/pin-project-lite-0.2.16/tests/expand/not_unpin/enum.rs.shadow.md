# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/pin-project-lite-0.2.16/tests/expand/not_unpin/enum.rs
@source-hash: c65aac4d2083e83d
@generated: 2026-02-09T18:02:33Z

## Purpose
Test file for pin-project-lite's `!Unpin` attribute functionality on enums, verifying that the generated projection types correctly handle pinned and unpinned fields while preventing the enum from implementing `Unpin`.

## Key Components

**Enum Definition (L9-16)**: `Enum<T, U>` - Generic enum with two variants:
- `Struct` variant (L10-14) containing a `#[pin]` field `pinned: T` and regular field `unpinned: U`
- `Unit` variant (L15) with no fields

**Pin Project Configuration (L5-8)**:
- `#[project(!Unpin)]` (L6) - Explicitly prevents `Unpin` implementation
- `#[project = EnumProj]` (L7) - Names the owned projection type
- `#[project_ref = EnumProjRef]` (L8) - Names the reference projection type

## Dependencies
- `pin_project_lite` crate (L3) - Provides the `pin_project!` macro for safe pin projections

## Architecture Notes
This is an expansion test that validates the macro generates correct projection types when `!Unpin` is specified. The generated code should create `EnumProj` and `EnumProjRef` types that properly handle the pinned `T` field while ensuring the original enum cannot implement `Unpin` automatically.

## Test Context
Located in `/tests/expand/not_unpin/` indicating this tests the "not unpin" behavior specifically for enums, likely compared against expected macro expansion output.