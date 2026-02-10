# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/macros_pin.rs
@source-hash: f8fe8ade470196dc
@generated: 2026-02-09T18:12:17Z

**Primary Purpose:** Test file for Tokio's `pin!` macro functionality, demonstrating proper usage of the macro to pin multiple futures for concurrent execution.

**Key Components:**
- **Conditional test framework imports (L3-7):** Uses platform-specific test attributes - `wasm_bindgen_test` for WASM targets, `tokio::test` for others
- **Test helper functions (L9-10):** Simple async functions `one()` and `two()` that serve as test futures
- **Main test function `multi_pin()` (L12-21):** Demonstrates `tokio::pin!` macro usage by pinning two futures and awaiting them sequentially

**Architectural Patterns:**
- Cross-platform test compatibility using conditional compilation
- Macro alias pattern with `maybe_tokio_test` for unified test attribute handling
- Pin projection testing - validates that pinned futures can be safely borrowed mutably

**Dependencies:**
- Requires `tokio` with "macros" feature
- Conditionally uses `wasm_bindgen_test` for WASM environments

**Critical Behavior:**
- The `tokio::pin!` macro creates stack-pinned futures that can be safely moved and referenced
- Sequential await pattern (`(&mut f1).await; (&mut f2).await`) tests mutable borrowing of pinned futures
- Test validates that pinned futures maintain memory safety guarantees