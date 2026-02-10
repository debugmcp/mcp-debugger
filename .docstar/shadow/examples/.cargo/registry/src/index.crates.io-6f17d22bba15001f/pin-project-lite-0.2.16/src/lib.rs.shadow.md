# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/pin-project-lite-0.2.16/src/lib.rs
@source-hash: 56accfe9d4ea6f09
@generated: 2026-02-09T18:11:53Z

**Purpose**: Provides the `pin_project!` declarative macro - a lightweight alternative to the pin-project crate for generating safe pin projections without proc-macro dependencies.

## Primary Functionality

The core macro `pin_project!` (L382-389) generates projection types and methods for structs/enums with pinned fields, enabling safe access to pinned data through `Pin<&mut T>`.

## Key Macros & Components

### Main Entry Point
- `pin_project!` (L382-389): Main macro that delegates to internal parsing infrastructure

### Internal Parsing Pipeline
- `__pin_project_internal!` (L1477-1619): Parses attributes (`#[project]`, `#[project_ref]`, `#[project_replace]`, `#[project(!Unpin)]`)
- `__pin_project_parse_generics!` (L1623-1688): Handles generic parameters and where clauses
- `__pin_project_expand!` (L402-467): Main expansion logic, orchestrates type generation
- `__pin_project_constant!` (L471-724): Generates implementation blocks within `const _: ()` scope

### Type Generation
- `__pin_project_reconstruct!` (L728-781): Recreates original struct/enum without pin attributes
- `__pin_project_make_proj_ty!` (L785-851): Creates projection types for mutable/immutable references
- `__pin_project_make_proj_replace_ty!` (L889-950): Creates replacement projection types

### Method Generation
- `__pin_project_struct_make_proj_method!` (L1019-1065): Generates `project()` and `project_ref()` for structs
- `__pin_project_enum_make_proj_method!` (L1114-1156): Generates projection methods for enums
- `__pin_project_struct_make_proj_replace_method!` (L1069-1110): Generates `project_replace()` for structs

### Field Transformation Helpers
- `__pin_project_make_proj_field_mut!` (L1444-1451): Transforms field types for mutable projections
- `__pin_project_make_proj_field_ref!` (L1455-1462): Transforms field types for immutable projections
- `__pin_project_make_unsafe_field_proj!` (L1411-1418): Creates safe/unsafe field projections in methods

### Trait Implementation
- `__pin_project_make_unpin_impl!` (L1214-1281): Generates conditional `Unpin` implementation or prevents it with `!Unpin`
- `__pin_project_make_drop_impl!` (L1285-1396): Handles `PinnedDrop` trait implementation or validates no `Drop` impl exists

### Safety Infrastructure
- `UnsafeDropInPlaceGuard<T>` (L1727-1742): Ensures proper dropping of replaced values
- `UnsafeOverwriteGuard<T>` (L1747-1765): Safely overwrites values without calling destructors
- `AlwaysUnpin<T>` (L1722-1723): Helper type that's always `Unpin` for non-pinned fields

## Architecture Patterns

**Token Tree Parsing**: Uses recursive macro expansion to parse complex syntax incrementally
**const Context**: All generated code lives in `const _: ()` blocks to avoid namespace pollution
**Visibility Downgrading**: Public types get `pub(crate)` projection types to prevent API leakage
**Safety Invariants**: Packed struct detection (L604-612) prevents undefined behavior from unaligned references

## Key Constraints & Limitations

- No support for tuple structs/variants
- No useful error messages (delegates to pin-project for diagnostics)
- No custom `Unpin` implementations
- Limited generic bounds support
- No interoperability with other field attributes

## Generated API Surface

For each `pin_project!` type, generates:
- `project(Pin<&mut Self>) -> ProjectionMut<'_>`
- `project_ref(Pin<&Self>) -> ProjectionRef<'_>`
- `project_replace(Pin<&mut Self>, Self) -> ProjectionReplace` (optional)
- Conditional `Unpin` implementation based on pinned fields
- `PinnedDrop` implementation (if provided)