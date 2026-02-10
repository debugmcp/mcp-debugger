# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/pin-project-lite-0.2.16/tests/ui/not_unpin/conflict-unpin.rs
@source-hash: 23c7e081d86f2000
@generated: 2026-02-09T18:02:36Z

**Primary Purpose**: Test file for pin-project-lite crate demonstrating conflicting `Unpin` implementations that should trigger compilation errors. Part of the UI test suite to verify proper error detection when manual `Unpin` implementations conflict with `#[project(!Unpin)]` annotations.

**Key Structures**:
- `Foo<T, U>` (L7-11): Generic struct with pinned field `f1` and unpinned field `f2`, annotated with `#[project(!Unpin)]` to disable automatic `Unpin` derivation
- `Bar<T, U>` (L18-22): Identical structure to `Foo` with same pin projection configuration  
- `Baz<T, U>` (L29-33): Same structure pattern as above two structs

**Conflicting Implementations**:
- `Unpin for Foo<T, U> where T: Unpin` (L14): Manual `Unpin` impl with conditional bound on `T`
- `Unpin for Bar<T, U>` (L25): Unconditional manual `Unpin` implementation
- `Unpin for Baz<T, U>` (L36): Manual `Unpin` impl requiring both `T` and `U` to be `Unpin`

**Dependencies**: 
- `pin_project_lite::pin_project` macro for generating pin projection code

**Test Pattern**: This follows the UI test pattern where each struct + impl combination represents a different conflict scenario that should be rejected by the compiler. The `#[project(!Unpin)]` attribute explicitly opts out of automatic `Unpin` derivation, making any manual `Unpin` implementation a conflict.

**Critical Constraint**: The combination of `#[project(!Unpin)]` with manual `Unpin` implementations should result in compilation errors, ensuring users cannot accidentally create unsound pin projections.