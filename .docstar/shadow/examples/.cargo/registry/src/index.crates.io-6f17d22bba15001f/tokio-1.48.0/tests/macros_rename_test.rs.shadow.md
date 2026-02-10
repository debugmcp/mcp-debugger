# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/macros_rename_test.rs
@source-hash: 94715e8014bc4c67
@generated: 2026-02-09T18:12:20Z

## Test file verifying Tokio macro crate rename functionality

**Purpose:** Validates that Tokio's procedural macros (`#[tokio::main]` and `#[tokio::test]`) correctly handle crate renaming scenarios where `tokio` is imported under different names or paths.

### Key Components

**Import Configuration (L3-10):**
- `std as tokio` (L4): Creates a name collision by shadowing tokio with std
- `::tokio as tokio1` (L6): Imports tokio under alternative name `tokio1`
- `mod test` with `pub use ::tokio` (L8-10): Creates nested path `test::tokio`

**Core Function (L12-15):**
- `compute()`: Async function that spawns a task using `tokio1::spawn()` and returns result
- Demonstrates actual tokio functionality works with renamed import

**Main Function Test (L17-25):**
- `compute_main()` (L17-20): Uses `#[tokio1::main(crate = "tokio1")]` attribute with explicit crate parameter
- `crate_rename_main()` (L22-25): Synchronous test verifying the main function works

**Async Test Cases:**
- `crate_rename_test()` (L27-30): Uses `#[tokio1::test(crate = "tokio1")]` with renamed import
- `crate_path_test()` (L32-35): Uses `#[test::tokio::test(crate = "test::tokio")]` with module path

### Architecture Pattern
Tests the macro system's ability to resolve the correct tokio crate when:
1. The standard `tokio` name is shadowed by other imports
2. Tokio is imported under alternative names
3. Tokio is accessed through module paths

**Dependencies:** Requires tokio "full" feature and excludes WASI targets due to threading limitations (L1).