# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/pin-project-lite-0.2.16/tests/expandtest.rs
@source-hash: a4336ab879d79824
@generated: 2026-02-09T18:11:37Z

**Primary Purpose:** Test file for macro expansion verification in pin-project-lite crate using macrotest framework.

**Key Components:**
- `expandtest()` function (L7-10): Integration test that verifies macro expansion output matches expected results
  - Uses `macrotest::expand_args()` to test all `.rs` files in `tests/expand/` directory
  - Runs with `--all-features` flag to test complete feature set
  - Only executes on nightly Rust compiler (L5 conditional compilation)

**Dependencies:**
- `macrotest` crate: Provides macro expansion testing capabilities
- `rustversion` crate: Enables conditional compilation based on Rust version

**Architectural Decisions:**
- Disabled under Miri (L3): Memory sanitizer incompatible with macro expansion testing
- Nightly-only execution: Macro expansion testing requires nightly compiler features
- Glob pattern matching: Tests all expansion files automatically without manual enumeration

**Test Strategy:**
- Snapshot testing approach: Compares actual macro expansion against stored expected output
- Comprehensive feature testing: `--all-features` ensures all conditional compilation paths are tested
- Directory-based organization: Expansion test cases stored in structured `tests/expand/` hierarchy