# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/pin-project-lite-0.2.16/tests/expand/multifields/enum.expanded.rs
@source-hash: f6ed5344acfb0ebc
@generated: 2026-02-09T18:02:31Z

## Pin Project Macro Expansion Test - Enum with Multiple Fields

This file contains the macro-expanded output of `pin_project_lite::pin_project` applied to an enum with multiple fields. It demonstrates the complete code generation for safe pin projection with field replacement functionality.

### Primary Components

**Original Enum Definition (L2-5)**
- `Enum<T, U>`: Generic enum with two variants
  - `Struct` variant: Contains 4 fields (2 pinned `T` fields, 2 unpinned `U` fields)  
  - `Unit` variant: Empty variant

**Generated Projection Types (L18-26)**
- `EnumProjReplace<T, U>`: Mirror enum for project-replace operations
  - Pinned fields replaced with `PhantomData<T>` markers
  - Unpinned fields retain original types

**Core Implementation (L36-78)**
- `project_replace()` method: Safe pin projection with field replacement
  - Uses `UnsafeOverwriteGuard` for memory safety during replacement
  - Extracts unpinned fields via `ptr::read()` 
  - Installs drop guards for pinned fields to prevent double-drop
  - Returns projection enum with phantom data for pinned fields

**Pin Safety Infrastructure (L81-96)**
- `__Origin` struct: Encodes pinning requirements per enum variant
  - Pinned fields represented as bare types
  - Unpinned fields wrapped in `AlwaysUnpin<T>`
- Conditional `Unpin` implementation based on `PinnedFieldsOf` analysis

**Drop Safety Validation (L97-100)**
- `MustNotImplDrop` trait: Compile-time check preventing manual `Drop` implementation
- Ensures pin projection safety by forbidding custom drop logic

### Key Safety Patterns

- Pin projection maintains memory safety through guard types
- PhantomData markers prevent access to moved pinned data
- Unsafe blocks are encapsulated within safe APIs
- Drop safety enforced at compile time

### Dependencies

- `pin_project_lite`: Core pin projection functionality and safety primitives
- Standard library: `PhantomData`, `Pin`, pointer operations