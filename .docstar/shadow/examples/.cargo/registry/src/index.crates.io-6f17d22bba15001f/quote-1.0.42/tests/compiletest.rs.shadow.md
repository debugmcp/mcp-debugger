# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/quote-1.0.42/tests/compiletest.rs
@source-hash: 4e381aa8ca3eabb7
@generated: 2026-02-09T18:11:44Z

**Purpose**: Compile-time failure test suite for the `quote` crate using the `trybuild` testing framework.

**Core Functionality**:
- `ui()` test function (L4-7): Executes UI tests that verify compile-time error messages and failure scenarios
- Uses `trybuild::TestCases` (L5) to create a test harness for compilation failure testing
- Targets all Rust source files in `tests/ui/*.rs` (L6) for compile-fail validation

**Key Dependencies**:
- `trybuild` crate: Provides compile-time testing infrastructure for proc macros and compile-fail scenarios
- `rustversion` crate: Enables conditional compilation based on Rust version

**Architectural Decisions**:
- **Nightly-only execution** (L1): Test is ignored on stable/beta Rust, suggesting it tests nightly-specific features or diagnostics
- **Miri incompatibility** (L2): Excluded from Miri execution, likely due to file system operations or proc macro limitations
- **Glob pattern testing** (L6): Batch processes multiple UI test files for comprehensive error message validation

**Testing Pattern**:
This implements the standard UI testing pattern for Rust proc macros, where test files are expected to fail compilation with specific error messages that are validated against expected output files.

**Critical Constraints**:
- Requires nightly Rust compiler for execution
- Cannot run under Miri interpreter
- Depends on external test files in `tests/ui/` directory structure