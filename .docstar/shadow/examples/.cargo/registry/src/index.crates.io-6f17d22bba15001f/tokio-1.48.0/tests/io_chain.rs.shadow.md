# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/io_chain.rs
@source-hash: f5d3ddc9f6e8152c
@generated: 2026-02-09T18:12:11Z

## Test file for Tokio's IO chaining functionality

**Purpose:** Integration test verifying the `chain()` method from `AsyncReadExt` trait works correctly with byte slice readers.

**Key Test Function:**
- `chain()` (L8-16): Async test demonstrating sequential reading from two chained byte slices using `AsyncReadExt::chain()`

**Test Flow:**
1. Creates empty buffer for reading into (L9)
2. Sets up two byte slice readers: "hello " and "world" (L10-11)
3. Chains the readers using `.chain()` method (L13)
4. Reads entire chained content to buffer using `read_to_end()` (L14)
5. Verifies concatenated result equals "hello world" (L15)

**Dependencies:**
- `tokio::io::AsyncReadExt` - Provides `chain()` and `read_to_end()` methods
- `tokio_test::assert_ok` - Assertion macro for Result unwrapping

**Test Configuration:**
- Requires "full" feature flag (L2)
- Uses `#[tokio::test]` attribute for async test execution (L7)

**Pattern:** Simple positive test case validating basic chaining behavior - no edge cases or error conditions tested.