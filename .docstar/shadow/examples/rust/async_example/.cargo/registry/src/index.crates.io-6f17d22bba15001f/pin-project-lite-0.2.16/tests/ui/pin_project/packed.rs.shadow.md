# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/pin-project-lite-0.2.16/tests/ui/pin_project/packed.rs
@source-hash: 6a24ac14e61e5d3e
@generated: 2026-02-09T18:02:38Z

**Purpose**: Test file verifying that `pin_project` macro correctly rejects structs with packed representation, demonstrating alignment safety constraints.

**Key Components**:
- `Packed` struct (L5-11): Test case with `#[repr(packed, C)]` and pinned `u16` field, expected to fail compilation with "reference to packed field is unaligned" error
- `PackedN` struct (L13-19): Test case with `#[repr(packed(2))]` and pinned `u32` field, also expected to fail with alignment error
- Empty `main()` function (L21): Required for compilation test framework

**Dependencies**:
- `pin_project_lite` crate for the `pin_project!` macro

**Architecture & Purpose**:
This is a negative test file (UI test) that validates the `pin_project_lite` macro's safety guarantees. The macro must reject packed structs because:
1. Packed structs have relaxed alignment requirements 
2. Pin projections require stable memory addresses
3. Unaligned references to packed fields are undefined behavior

**Test Pattern**:
Uses `//~ ERROR` comments to specify expected compilation failures, typical of Rust compiler UI test suite. Both test cases should fail at compile-time with alignment-related errors.

**Critical Constraint**: The `pin_project` macro enforces memory safety by preventing projection of pinned fields in packed structs where alignment cannot be guaranteed.