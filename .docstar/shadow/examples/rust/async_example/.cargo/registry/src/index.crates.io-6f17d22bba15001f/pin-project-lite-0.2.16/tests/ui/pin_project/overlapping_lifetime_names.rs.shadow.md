# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/pin-project-lite-0.2.16/tests/ui/pin_project/overlapping_lifetime_names.rs
@source-hash: ac9c29b389e8e067
@generated: 2026-02-09T18:02:39Z

## Primary Purpose
Negative test case for the `pin-project-lite` crate's macro expansion, specifically testing lifetime parameter name collision detection. This test verifies that the macro properly rejects structs that use the reserved `'__pin` lifetime name.

## Key Elements
- **Test Structure `Foo<'__pin, T>` (L6-9)**: Generic struct with intentionally problematic lifetime parameter name `'__pin` that conflicts with pin-project-lite's internal lifetime naming convention
- **Pinned Field (L8)**: Mutable reference field marked with `#[pin]` attribute using the conflicting lifetime
- **Expected Errors (L5)**: Comment indicates this should trigger compiler errors E0263 (lifetime name conflicts) and E0496 (lifetime parameter issues)

## Dependencies
- **pin_project_lite::pin_project (L3)**: Core macro being tested for proper error handling

## Test Architecture
This is a UI test (compile-fail test) that validates the macro's error reporting capabilities. The `pin_project!` macro should detect the lifetime name collision with its internal `'__pin` convention and produce appropriate compiler errors rather than generating invalid code.

## Critical Constraints
- Lifetime name `'__pin` is reserved by the pin-project-lite implementation
- Test expects specific error codes (E0263, E0496) to be generated during macro expansion
- File serves as regression test to ensure macro maintains proper namespace isolation