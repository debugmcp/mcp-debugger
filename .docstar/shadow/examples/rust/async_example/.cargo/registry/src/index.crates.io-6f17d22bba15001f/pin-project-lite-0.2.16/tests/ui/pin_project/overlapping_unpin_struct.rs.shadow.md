# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/pin-project-lite-0.2.16/tests/ui/pin_project/overlapping_unpin_struct.rs
@source-hash: cb3d6d4087b8b4c9
@generated: 2026-02-09T18:02:37Z

**Purpose:** Test case for pin-project-lite demonstrating overlapping Unpin trait implementations that should cause compilation errors.

**Core Components:**
- `Foo<T>` struct (L8-12): Generic pin-projected struct with pinned inner field of type T
- `__Origin` struct (L14): Empty marker struct that implements Unpin
- `is_unpin<T: Unpin>()` function (L18): Trait bound test function requiring Unpin implementation
- Test assertion (L21): Attempts to call `is_unpin` with `Foo<PhantomPinned>`, expects compile error E0277

**Key Dependencies:**
- `std::marker::PhantomPinned`: Non-Unpin marker type used to create pinning constraints
- `pin_project_lite::pin_project`: Macro for generating pin projection boilerplate

**Test Logic:**
The test verifies that `Foo<PhantomPinned>` does NOT implement Unpin, since:
1. `Foo` contains a `#[pin]` field of type `PhantomPinned`
2. `PhantomPinned` explicitly does not implement Unpin
3. Pin-projected structs with pinned non-Unpin fields should not be Unpin themselves

**Expected Behavior:** Compilation should fail at L21 with error E0277 indicating that `Foo<PhantomPinned>` doesn't satisfy the Unpin trait bound, demonstrating correct pin projection semantics.