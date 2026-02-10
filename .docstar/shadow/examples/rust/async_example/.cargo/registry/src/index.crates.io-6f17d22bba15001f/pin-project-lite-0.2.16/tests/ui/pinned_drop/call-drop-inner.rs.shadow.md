# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/pin-project-lite-0.2.16/tests/ui/pinned_drop/call-drop-inner.rs
@source-hash: 0618b60a450c99b5
@generated: 2026-02-09T18:02:39Z

## Purpose
Test case for pin-project-lite crate demonstrating improper usage of internal `__drop_inner` function within a PinnedDrop implementation. This is likely a negative test case that should fail compilation.

## Key Components
- **Struct S (L6-9)**: Simple struct with a single pinned field of type u8
  - `#[pin]` attribute on `field` indicates it should be treated as pinned when projected
- **PinnedDrop Implementation (L10-14)**: Custom drop implementation for pinned types
  - Calls `__drop_inner(this)` which appears to be an internal/private function from pin-project-lite
  - This usage pattern is likely incorrect and should trigger compilation errors
- **Main Function (L17-19)**: Creates instance of S to trigger drop behavior

## Dependencies
- `pin_project_lite`: Macro crate for safe pin projection without proc-macros
- Uses `Pin<&mut Self>` from std::pin

## Test Context
This appears to be a UI test (under `tests/ui/` directory) designed to validate that calling internal `__drop_inner` function directly results in appropriate compiler errors. The test likely expects compilation failure with specific error messages about accessing private/internal APIs.

## Architectural Notes
- Uses `pin_project!` macro to generate safe pin projection code
- PinnedDrop trait allows custom cleanup logic for pinned types
- The `__drop_inner` call suggests an attempt to manually invoke generated drop code, which should be prevented by the crate's design